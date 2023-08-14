/**
 * breeder controller
 */

import { factories } from "@strapi/strapi";
const stripe = require("stripe")(
  process.env.STRAPI_ADMIN_TEST_STRIPE_SECRET_KEY
);
export default factories.createCoreController("api::breeder.breeder");

module.exports = factories.createCoreController(
  "api::breeder.breeder",
  ({ strapi }) => ({
    setupStripePayoutAccount: async (ctx, next) => {
      strapi.log.info(`Starting setup breeder stripe payout account.`);

      const user = ctx.state.user;
      const breeder = await strapi.entityService.findOne(
        "api::breeder.breeder",
        user.breederId,
        {
          populate: ["avatar"],
        }
      );
      let onboarding_url: string = "";

      const currentUser = await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        user.id,
        {
          populate: {
            avatar: true,
          },
        }
      );

      if (!currentUser.isSubscribed) {
        strapi.log.info(`Breeder isn't subscribed yet.`);
        return {
          onboarding_url: null,
        };
      }

      if (currentUser.stripeAccountId && currentUser.stripeAccountLink) {
        const accountLink = await stripe.accountLinks.create({
          account: currentUser.stripeAccountId,
          refresh_url: "https://example.com/reauth",
          return_url: "https://example.com/return",
          type: "account_onboarding",
        });
        const updateQuery = {
          where: {
            id: user.id,
          },
          data: {
            publishedAt: new Date().toISOString(),
            breeder: breeder.id,
            stripeAccountLink: accountLink.url,
            stripeAccountLinkJSON: accountLink,
          },
        };
        await strapi.db
          .query("plugin::users-permissions.user")
          .update(updateQuery);
        return {
          onboarding_url: `${accountLink.url}?prefilled_email=${user.email}`,
        };
      }

      // create stripe account
      const stripeAccount = await stripe.accounts.create({
        type: "express",
        country: "AU",
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        business_profile: {
          name: breeder.registryName,
          url: `${process.env.CLIENT_URL}/breeder/${breeder.id}`,
        },
        settings: {
            payouts: {
                schedule: {
                    delay_days: 5
                }
            }
        }
      });

      if (stripeAccount) {
        // create stripe account link for onboarding (creating payout account)
        const accountLink = await stripe.accountLinks.create({
          account: stripeAccount.id,
          refresh_url: "https://example.com/reauth",
          return_url: "https://example.com/return",
          type: "account_onboarding",
        });
        if (accountLink) {
          onboarding_url = accountLink.url;
          const updateQuery = {
            where: {
              id: user.id,
            },
            data: {
              publishedAt: new Date().toISOString(),
              breeder: breeder.id,
              stripeAccountId: stripeAccount.id,
              stripeAccountJSON: stripeAccount,
              stripeAccountLink: accountLink.url,
              stripeAccountLinkJSON: accountLink,
            },
          };
          await strapi.db
            .query("plugin::users-permissions.user")
            .update(updateQuery);
        }
      }

      return {
        onboarding_url: `${onboarding_url}?prefilled_email=${user.email}`,
      };
    },
  })
);

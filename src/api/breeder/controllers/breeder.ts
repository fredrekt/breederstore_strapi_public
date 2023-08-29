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
          refresh_url: `${process.env.CLIENT_URL}/breeder/onboarding`,
          return_url: `${process.env.CLIENT_URL}/stripe/success`,
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
          refresh_url: `${process.env.CLIENT_URL}/breeder/onboarding`,
          return_url: `${process.env.CLIENT_URL}/stripe/success`,
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
    update: async (ctx, next) => {
      strapi.log.info(`update breeder: ${JSON.stringify(ctx.request.body.data)}`);
      if (ctx.request.body.data.hasOwnProperty('onboarding_registration') && ctx.request.body.data.onboarding_registration) {
        const currentBreeder = await strapi.entityService.findOne(
          "api::breeder.breeder",
          ctx.params.id,
          {
            populate: {
              avatar: true,
              cardPhoto: true,
              coverPhoto: true,
            },
          }
        );
        // send email to admin for BREEDER REGISTRATION APPROVAL
        const updateData: any = ctx.request.body.data;
        await strapi.plugins["email"].services.email.send({
          to: ['fredrickjohng98@gmail.com', process.env.SENDGRID_DEFAULT_TO],
          from: `Breeder Verification <${process.env.SENDGRID_DEFAULT_FROM}>`, //e.g. single sender verification in SendGrid
          template_id: process.env.SENDGRID_BREEDER_APPROVAL_TEMPLATE_ID,
          dynamic_template_data: {
            breeder_name: updateData.businessName || '',
            breeder_address: updateData.businessAddress || '',
            breeder_phone: ctx.state.user.phone || '',
            breeder_email: ctx.state.user.email || '',
            breeder_bio: updateData.aboutBusiness || '',
            breeder_avatar: currentBreeder.avatar.url || '',
            approve_link: `https://mybreedersstore-backend-d8d923592f33.herokuapp.com/api/verify/${currentBreeder.id}/approve`,
            deny_link: `https://mybreedersstore-backend-d8d923592f33.herokuapp.com/api/breeder/verifiy/${currentBreeder.id}/reject`
          } 
        });
        // delete this initial onboarding 
        delete ctx.request.body.data.onboarding_registration
      }
      const updateBreeder = await strapi.entityService.update(
        "api::breeder.breeder",
        ctx.params.id,
        {
          data: {
            ...ctx.request.body.data,
            updatedAt: new Date().toISOString(),
          },
        }
      );
      return updateBreeder;
    },
    verifyBreeder: async (ctx, next) => {
      try {
        const { id, action } = ctx.params;
  
        if (!id || !action) {
          return ctx.throw(400, 'Missing required parameters');
        }
  
        const currentBreeder = await strapi.entityService.findOne(
          "api::breeder.breeder",
          id,
          {
            populate: {
              avatar: true,
              cardPhoto: true,
              coverPhoto: true,
              user: true
            },
          }
        );

        if (!currentBreeder) {
          return ctx.throw(400, `Breeder doesn't seem to exist.`);
        }

        const breederEmail: string = currentBreeder.user.email;

        strapi.log.info(`Verifying breeder: ${JSON.stringify(currentBreeder)}`);
        strapi.log.info(`Breeder Email: ${breederEmail}`);

        if (action === 'approve') {
          // send congratulations to breeder email
          await strapi.plugins["email"].services.email.send({
            to: breederEmail,
            from: `My Breeder Store <${process.env.SENDGRID_DEFAULT_FROM}>`,
            template_id: process.env.SENDGRID_BREEDER_APPROVAL_APPROVED_TEMPLATE_ID
          });
          await strapi.entityService.update(
            "api::breeder.breeder",
            currentBreeder.id,
            {
              data: {
                isVerified: true,
                updatedAt: new Date().toISOString(),
              },
            }
          );
        } else if (action === 'reject') {
          // send denied to breeder email
          await strapi.plugins["email"].services.email.send({
            to: breederEmail,
            from: `My Breeder Store <${process.env.SENDGRID_DEFAULT_FROM}>`,
            template_id: process.env.SENDGRID_BREEDER_APPROVAL_DENIED_TEMPLATE_ID
          });
          await strapi.entityService.update(
            "api::breeder.breeder",
            currentBreeder.id,
            {
              data: {
                isVerified: false,
                updatedAt: new Date().toISOString(),
              },
            }
          );
        } else {
          return ctx.throw(400, 'Invalid action');
        }
        ctx.send('<p>Verification successfully processed. This window will close shortly.</p><script>window.setTimeout(function() { window.close(); }, 1500);</script>');
      } catch (error) {
        strapi.log.error('Error in verifyBreeder:', error.message);
        ctx.throw(500, 'Internal Server Error: Breeder Verification');
      }
    }
  })
);

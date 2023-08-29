module.exports = () => {
  return async (ctx, next) => {
    await next();
    // only if path was register with newsletter param and it was successfull. Then we will put user in the mailing list.
    if (
      ctx.request.url === "/api/auth/local/register?breeder=true" &&
      ctx.response.status === 200
    ) {
      const user = ctx.response.body.user;
      const userId = ctx.response.body.user.id;
      const registryName = ctx.request.body.registryName;
      const prefix = ctx.request.body.prefix;

      const createBreeder = await strapi.db
        .query("api::breeder.breeder")
        .create({
          data: {
            businessName: registryName,
            prefix: prefix,
            user: userId,
            publishedAt: new Date().toISOString(),
          },
        });

      if (createBreeder) {
        const updateQuery = {
          where: {
            id: userId,
          },
          data: {
            publishedAt: new Date().toISOString(),
            breeder: createBreeder.id,
          },
        };
        await strapi.db
          .query("plugin::users-permissions.user")
          .update(updateQuery);
        strapi.log.info(`creating breeder: ${createBreeder.id}`);
        // Include breeder in the user object
        user.breeder = createBreeder.id;

        // Update the response body with the modified user object
        ctx.response.body.user = user;
      }
    }
    if (
      ctx.request.url.includes("/api/auth/local/register") &&
      ctx.response.status === 200
    ) {
      const user = ctx.response.body.user;
      let dynamicTemplateData: any = {};
      if (user.isBuyer) {
        dynamicTemplateData.first_name = user.firstName;
      } else {
        const { breeder } = await strapi.entityService.findOne(
          "plugin::users-permissions.user",
          user.id,
          {
            fields: ["id"],
            populate: { breeder: true },
          }
        );
        dynamicTemplateData.breeder_name = breeder.businessName;
      }
      await strapi.plugins["email"].services.email.send({
        to: user.email,
        from: `My Breeders Store <${process.env.SENDGRID_DEFAULT_FROM}>`,
        template_id: user.isBuyer ? process.env.SENDGRID_WELCOME_BUYER_TEMPLATE_ID : process.env.SENDGRID_WELCOME_BREEDER_TEMPLATE_ID,
        dynamic_template_data: dynamicTemplateData 
      });
    }
    if (ctx.request.url.includes("/api/auth/local") &&
    ctx.response.status === 200) {
      const user = ctx.response.body.user;
      if (!user.isBuyer) {
        const { breeder } = await strapi.entityService.findOne(
          "plugin::users-permissions.user",
          ctx.response.body.user.id,
          {
            fields: ["id"],
            populate: { breeder: true },
          }
        );
        if (breeder) {
          user.breeder = breeder;
        }
      }
      ctx.response.body.user = user;
    }
  };
};

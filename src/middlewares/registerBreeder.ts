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
      await strapi.plugins["email"].services.email.send({
        to: user.email,
        from: "My Breeder Store <fredrickjohng98@gmail.com>", //e.g. single sender verification in SendGrid
        template_id: "d-f00562af97d94931829185143ab96c20",
      });
    }
  };
};

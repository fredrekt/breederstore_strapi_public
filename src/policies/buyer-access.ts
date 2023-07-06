/**
 * buyer-access policy
 */

export default async (policyContext, config, { strapi }) => {
  strapi.log.info("Buyer access only.");

  if (policyContext.state.user.isBuyer) {
    const { isBuyer } = await strapi.entityService.findOne(
      "plugin::users-permissions.user",
      policyContext.state.user.id
    );
    if (!isBuyer) return false;
    return true;
  }
  return false;
};

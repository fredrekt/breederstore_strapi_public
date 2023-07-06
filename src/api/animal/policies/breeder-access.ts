/**
 * breederAccess policy
 */

export default async (policyContext, config, { strapi }) => {
  // Add your own logic here.
  strapi.log.info(`In breederAccess policy.`);
  const ctx = strapi.requestContext.get();
  const id = ctx.params.id;
  const breederId = policyContext.state.user.breederId;
  
  const isOwner = await strapi.db.query('api::animal.animal').findOne({
    where: {
      $and: [
        {
          breeder: breederId,
        },
        {
          id: id,
        },
      ],
    }
  });

  if (isOwner) {
    strapi.log.info(`deleting id: ${id} breeder id: ${breederId}`);
    return true;
  }
  strapi.log.info(`Unauthorized action.`);
  return false;

};

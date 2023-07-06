/**
 * animal router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::animal.animal', {
    config: {
        create: {
            policies: [
                'global::includeUserRelations'
            ]
        },
        update: {
            policies: [
                'global::includeUserRelations',
                'breeder-access'
            ] 
        },
        delete: {
            policies: [
                'global::includeUserRelations',
                'breeder-access'
            ] 
        }
    }
});

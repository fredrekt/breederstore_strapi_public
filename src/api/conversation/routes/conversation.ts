/**
 * conversation router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::conversation.conversation', {
    config: {
        create: {
            policies: [
                'global::buyer-access'
            ] 
        }
    }
});

/**
 * conversation controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::conversation.conversation');

module.exports = factories.createCoreController('api::conversation.conversation', ({ strapi }) => ({
    create: async (ctx, next) => {
        strapi.log.info(`creating conversation: ${JSON.stringify(ctx.request.body)}`);
        const { user } = await strapi.entityService.findOne('api::breeder.breeder', 
        ctx.request.body.breederId,
        {
            populate: { user: true },
        });
        strapi.log.info(`breeder user id: ${JSON.stringify(user)}`)
        const createConversation =  await strapi.entityService.create('api::conversation.conversation', {
            data: {
                receiver: user.id,
                sender: ctx.state.user.id,
                publishedAt: new Date().toISOString()
            }
        })
        if (createConversation) {
            strapi.log.info(`conversation id: ${JSON.stringify(createConversation)}`);
            await strapi.entityService.create('api::message.message', {
                data: {
                    message: ctx.request.body.message,
                    conversation: createConversation.id,
                    sender: ctx.state.user.id,
                    publishedAt: new Date().toISOString()
                }
            })
        }
        return createConversation;
    },
    find: async (ctx, next) => {
        let conversations = [];
        const userRequest = ctx.state.user;
        strapi.log.info(`get conversations of ${userRequest.username} ${userRequest.isBuyer ? 'buyer' : 'breeder'}`);
        if (userRequest.isBuyer) {
            conversations = await strapi.db.query('api::conversation.conversation').findMany({
                where: {
                    sender: userRequest.id
                },
                populate: ['receiver', 'messages', 'receiver.breeder', 'messages.sender', 'messages.sender.avatar', 'receiver.breeder.avatar'],
                orderBy: {
                    updatedAt: 'desc'
                }
            });
        } else {
            conversations = await strapi.db.query('api::conversation.conversation').findMany({
                where: {
                    receiver: userRequest.id
                },
                populate: ['sender', 'messages', 'receiver', 'messages.sender', 'messages.sender.avatar', 'receiver.breeder.avatar', 'sender.avatar'],
                orderBy: {
                    updatedAt: 'desc'
                }
            });
        }
        return conversations;
    }
}))

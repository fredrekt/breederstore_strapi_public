/**
 * A set of functions called "actions" for `webhooks`
 */
const stripe = require("stripe")(
  process.env.STRAPI_ADMIN_TEST_STRIPE_SECRET_KEY
);
const unparsed = require("koa-body/unparsed.js");

export default {
  stripeWebhook: async (ctx, next) => {
    try {
      const event = await stripe.webhooks.constructEvent(
        ctx.request.body[unparsed],
        ctx.request.headers['stripe-signature'],
        process.env.STRIPE_WEBHOOK_ENDPOINT_SECRET
      );
      

      if (event.type === 'checkout.session.completed') {
        strapi.log.info(`stripe event: ${JSON.stringify(event)}`);
        const clientEmail: string = event.data.object.customer_details.email;
        strapi.log.info(`client email: ${clientEmail}`);

        if (clientEmail) {
          const io = require("socket.io")(strapi.server.httpServer, {
            cors: {
              // cors setup
              origin: "*",
              methods: ["GET", "POST"],
              allowedHeaders: ["my-custom-header"],
              credentials: true,
            },
          });
          io.on('connection', (socket) => {
            socket.emit("checkoutSuccessful", {
              email: clientEmail,
              message: "Stripe checkout payment successful",
              data: event.data
            });
          })
        }
      }
      ctx.send({ received: true }); // Send a response to Stripe
    } catch (error) {
      console.error('Stripe webhook error:', error);
      ctx.response.status = 400;
      ctx.send({ error: 'Webhook processing failed' });
    }
  }
};

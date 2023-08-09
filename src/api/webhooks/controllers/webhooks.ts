const stripe = require("stripe")(
  process.env.STRAPI_ADMIN_TEST_STRIPE_SECRET_KEY
);
const unparsed = require("koa-body/unparsed.js");
const io = require("socket.io")(strapi.server.httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true,
  },
});

module.exports = {
  stripeWebhook: async (ctx) => {
    try {
      const event = await stripe.webhooks.constructEvent(
        ctx.request.body[unparsed],
        ctx.request.headers['stripe-signature'],
        process.env.STRIPE_WEBHOOK_ENDPOINT_SECRET
      );

      if (event.type === 'checkout.session.completed') {
        const clientEmail = event.data.object.customer_details.email;
        if (clientEmail && event.data.object) {
          io.emit("useCheckoutStripeSuccess", {
            email: clientEmail,
            message: "Stripe checkout payment successful",
            data: event.data.object,
          });
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

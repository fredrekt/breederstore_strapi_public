export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  bootstrap(/*{ strapi }*/) {
    //strapi.server.httpServer is the new update for Strapi V4
    const io = require("socket.io")(strapi.server.httpServer, {
      cors: {
        // cors setup
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["my-custom-header"],
        credentials: true,
      },
    });
    io.on("connection", function (socket) {
      //Listening for a connection from the frontend

      // Handle socket connection events here
      console.log("New client connected");
      socket.emit("welcome", "Welcome to the Socket.io server!");

      socket.on("sendMessage", async (data) => {
        // Listening for a sendMessage connection
        let strapiData = {
          // Generating the message data to be stored in Strapi
          data: {
            sender: data.sender,
            conversation: data.conversation,
            message: data.message,
          },
        };
        strapi.log.info(`message request: ${JSON.stringify(strapiData)}`);
        const message = await strapi.entityService.create(
          "api::message.message",
          {
            data: {
              ...strapiData.data,
              publishedAt: new Date().toISOString(),
            },
          }
        );
        if (message) {
          await strapi.entityService.update(
            "api::conversation.conversation",
            strapiData.data.conversation,
            {
              data: {
                updatedAt: new Date().toISOString(),
              },
            }
          );
          strapi.log.info(`message creation data: ${JSON.stringify(message)}`)
          io.to(strapiData.data.conversation).emit("newMessage", {
            sender: strapiData.data.sender,
            message: strapiData.data.message,
            conversation: data.conversation,
            updatedAt: new Date().toISOString(),
          });
        }
      });

      socket.on('joinConversation', (conversationId) => {
        socket.join(conversationId);
      });
  
      socket.on('leaveConversation', (conversationId) => {
        socket.leave(conversationId);
      });

    });
  },
};

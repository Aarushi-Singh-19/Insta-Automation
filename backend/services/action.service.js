class ActionService {
  async execute(action) {
    if (action.type === "reply") {
      return this.replyToComment(action);
    }

    if (action.type === "send_dm") {
      return this.sendDM(action);
    }

    console.log("Unknown action type:", action);
  }

  async replyToComment(action) {
    const { username, message } = action;
    console.log(`💬 Replying to @${username}: ${message}`);
  }

  async sendDM(action) {
    const { username, message } = action;
    console.log(`📩 Sending DM to @${username}: ${message}`);
  }
}

module.exports = new ActionService();
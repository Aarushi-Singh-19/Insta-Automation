const sendDM = async (username, message) => {
  console.log("Sending DM...");
  
  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log(`DM sent to ${username}`);
  console.log(`Message: ${message}`);

  return {
    success: true,
  };
};

module.exports = { sendDM };
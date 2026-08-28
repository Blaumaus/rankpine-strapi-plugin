export default {
  default: {
    rankpineUrl: "https://rankpine.com",
    publicUrl: "",
  },
  validator(config) {
    if (config.rankpineUrl && !String(config.rankpineUrl).startsWith("https://")) {
      throw new Error("rankpineUrl must use HTTPS.");
    }
    if (config.publicUrl && !String(config.publicUrl).startsWith("https://")) {
      throw new Error("publicUrl must use HTTPS.");
    }
  },
};

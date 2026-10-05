window.SURVEY_CONFIG = {
  surveyVersion: "2026.09.14-comparison-layout-v5",
  // GASをウェブアプリとしてデプロイ後、/exec URLを設定してください。
  gasEndpoint: "https://script.google.com/macros/s/AKfycbzfAMyk9jnmE39iwD1CkqIQvVlW05bwPZgpw8890Wt0HH_W3UAGyI0jyY0ThSI8LA0/exec",
  requireGasEndpointForFinalSubmit: true,
  transformImagePath(characterId, variantId) {
    return `../assets/survey/transforms/${characterId}/${variantId}.png`;
  }
};

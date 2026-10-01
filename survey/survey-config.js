window.SURVEY_CONFIG = {
  surveyVersion: "2026.09.14-comparison-layout-v5",
  // GASをウェブアプリとしてデプロイ後、/exec URLを設定してください。
  gasEndpoint: "https://script.google.com/macros/s/AKfycbyi5njcLQ0R5a2y3_wxlijXABwcwGChorWVoMOwR1PLtjUFSZuzy0EP-g974SjmMBTo/exec",
  requireGasEndpointForFinalSubmit: true,
  transformImagePath(characterId, variantId) {
    return `../assets/survey/transforms/${characterId}/${variantId}.png`;
  }
};

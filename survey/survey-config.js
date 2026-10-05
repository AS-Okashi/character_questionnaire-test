window.SURVEY_CONFIG = {
  surveyVersion: "2026.09.14-comparison-layout-v5",
  // GASをウェブアプリとしてデプロイ後、/exec URLを設定してください。
  gasEndpoint: "https://script.google.com/macros/s/AKfycbztVZJ77U1T-h-jEV7VD4HWTxr38m69X03ShnWdRo6wqlLmsoUG360Gh__P53I1wKA/exec",
  requireGasEndpointForFinalSubmit: true,
  transformImagePath(characterId, variantId) {
    return `../assets/survey/transforms/${characterId}/${variantId}.png`;
  }
};

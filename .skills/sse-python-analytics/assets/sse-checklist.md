# SSE Deployment Checklist

## Infrastructure
- [ ] `qlik-py-tools` container/service is running and healthy.
- [ ] Container port is exposed and reachable from every Qlik engine/reload node.
- [ ] Qlik analytics connection (QMC) points to the correct host/port/protocol.
- [ ] Smoke-test `ScriptEval` call succeeds during reload.
- [ ] Required Python libraries are installed (see `Qlik-Py-Init` output).
- [ ] gRPC message size limit is adequate for your data volume (default: 10 MB).

## Environment & Credentials
- [ ] `.env` file is created from `.env.example` with real credentials.
- [ ] Azure OpenAI credentials are configured (if using LLM_Chat functions).
- [ ] Azure AI Foundry credentials are configured (if using LLM_Claude_Chat functions).
- [ ] `.env` file is excluded from source control (gitignored).

## Analytics Workflow — Forecasting (Prophet / StatsForecast)
- [ ] Forecast frequency (`freq`) matches your data granularity (D/W/MS).
- [ ] Forecast horizon (`periods`) is appropriate for business needs.
- [ ] Holiday calendar is populated if using `Prophet_Holidays`.
- [ ] Additional regressors are validated if using `Prophet_Multivariate`.
- [ ] For StatsForecast: model is appropriate (AutoARIMA for general, CrostonSBA for intermittent).
- [ ] Forecast results are spot-checked against known historical values.
- [ ] `take_log=true` is tested if data has multiplicative seasonality.

## Analytics Workflow — ML (sklearn / XGBoost / LightGBM)
- [ ] Model training data is loaded and validated (no nulls in target).
- [ ] Feature definitions match actual data columns and types.
- [ ] Model is trained (`sklearn_Fit`) and metrics reviewed.
- [ ] For regressors: R², MAE, RMSE are acceptable for business use.
- [ ] For classifiers: accuracy, precision, recall are acceptable.
- [ ] Feature importances are reviewed (`sklearn_Explain_Importances`).
- [ ] Predictions are spot-checked against known outcomes.
- [ ] Model file is persisted and backed up.

## Analytics Workflow — LLM Recommendations
- [ ] System prompts are tested and return structured output (e.g., JSON).
- [ ] Temperature is set low (0–0.3) for deterministic business outputs.
- [ ] Token limits are sufficient for expected response length.
- [ ] Bulk LLM calls are tested with a small sample before full reload.
- [ ] LLM costs are estimated for production batch sizes.

## Production Readiness
- [ ] Reload logs are reviewed for SSE endpoint and script errors.
- [ ] Container image tag + Qlik script changes are committed to source control.
- [ ] Monitoring/alerting is configured for SSE service health.
- [ ] Model retraining schedule is defined (if applicable).
- [ ] Fallback behavior is implemented for SSE outages.

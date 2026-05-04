---
name: sse-machine-learning
description: >
  Train and deploy ML models (sklearn/XGBoost/LightGBM) in Qlik via SSE for
  predictions and scoring. Covers the full pipeline: model setup, feature
  definition, training, evaluation, feature importance, and both chart
  expression and bulk load script prediction patterns.
license: Apache-2.0
platforms: ["client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "1.0"
  category: sse
---

# SSE Machine Learning

## When to Use

- User wants to train or use ML models in Qlik
- User mentions sklearn, XGBoost, LightGBM, RandomForest, prediction, or classification
- User needs to predict values, classify records, or score data
- User asks about model training, feature engineering, or evaluation metrics
- User wants reorder predictions, churn scoring, or similar ML use cases

## Prerequisites

- qlik-py-tools running with scikit-learn, xgboost, lightgbm installed
- Analytics connection configured (e.g., `PyTools`)
- Training data available in the Qlik data model

## The ML Pipeline

```
1. Setup    → Configure estimator, scaler, test split
2. Features → Define columns: feature, target, identifier, encoding
3. Train    → Fit the model on training data
4. Evaluate → Check metrics (R², MAE, accuracy, etc.)
5. Explain  → Review feature importances
6. Predict  → Score new data (chart or load script)
```

## Step 1: Model Setup

```qlik
SET vSseConnection = 'PyTools';
SET vModelName = 'reorder_model';

Setup:
LOAD * INLINE [
    model_name, estimator_args, scaler_args, execution_args
    $(vModelName), estimator=XGBRegressor|n_estimators=200|learning_rate=0.05|max_depth=8, scaler=RobustScaler, test_size=0.2|random_state=42|debug=true
];

SetupResult:
LOAD * EXTENSION $(vSseConnection).sklearn_Setup(Setup{model_name, estimator_args, scaler_args, execution_args});
DROP TABLE Setup;
TRACE Model setup complete;
```

### Available Estimators

| Estimator | Type | Best For |
|---|---|---|
| `XGBRegressor` | Regression | Numeric predictions (reorder qty, revenue) |
| `XGBClassifier` | Classification | Binary/multi-class (churn, risk level) |
| `LGBMRegressor` | Regression | Large datasets, fast training |
| `LGBMClassifier` | Classification | Large datasets, fast training |
| `RandomForestRegressor` | Regression | Robust, less tuning needed |
| `RandomForestClassifier` | Classification | Robust, less tuning needed |
| `GradientBoostingRegressor` | Regression | Good default choice |
| `GradientBoostingClassifier` | Classification | Good default choice |

### Available Scalers

| Scaler | Best For |
|---|---|
| `StandardScaler` | Normally distributed features |
| `RobustScaler` | Features with outliers (recommended default) |
| `MinMaxScaler` | Features that need 0-1 range |
| `none` | Tree-based models (don't need scaling) |

## Step 2: Define Features

```qlik
Features:
LOAD * INLINE [
    model_name, feature_name, var_type, data_type, strategy, strategy_args
    $(vModelName), AvgDailySales, feature, float, none,
    $(vModelName), SalesVariance, feature, float, none,
    $(vModelName), LeadTimeDays, feature, int, none,
    $(vModelName), Category, feature, str, one_hot_encoding,
    $(vModelName), DayOfWeek, feature, int, one_hot_encoding,
    $(vModelName), Month, feature, int, one_hot_encoding,
    $(vModelName), ReorderQty, target, float, none,
];

FeaturesResult:
LOAD * EXTENSION $(vSseConnection).sklearn_Set_Features(Features{model_name, feature_name, var_type, data_type, strategy, strategy_args});
DROP TABLE Features;
TRACE Features defined;
```

### Variable Types

| var_type | Purpose |
|---|---|
| `feature` | Input variable for prediction |
| `target` | What we're predicting (one per model) |
| `identifier` | Row key, excluded from training (e.g., ProductID) |
| `excluded` | Loaded but not used in training |

### Encoding Strategies

| strategy | Use When |
|---|---|
| `none` | Numeric fields (int, float) |
| `one_hot_encoding` | Categorical with few values (<20) |
| `hashing` | Categorical with many values |
| `text_similarity` | Text fields |
| `count_vectorizing` | Text → word counts |
| `tf_idf` | Text → TF-IDF features |

## Step 3: Train the Model

```qlik
TrainingData:
LOAD
    '$(vModelName)' as model_name,
    AvgDailySales,
    SalesVariance,
    LeadTimeDays,
    Category,
    DayOfWeek,
    Month,
    ReorderQty
RESIDENT FactReorderHistory;

TRACE Training with $(NoOfRows('TrainingData')) rows...;

TrainResult:
LOAD * EXTENSION $(vSseConnection).sklearn_Fit(TrainingData{model_name, AvgDailySales, SalesVariance, LeadTimeDays, Category, DayOfWeek, Month, ReorderQty});
DROP TABLE TrainingData;
TRACE Model training complete;
```

**Important:** The field order in the `sklearn_Fit` call must match the order defined in `sklearn_Set_Features`.

## Step 4: Evaluate

```qlik
MetricsInput:
LOAD '$(vModelName)' as model_name AUTOGENERATE 1;

Metrics:
LOAD * EXTENSION $(vSseConnection).sklearn_Get_Metrics(MetricsInput{model_name});
DROP TABLE MetricsInput;
TRACE Review Metrics table for model performance;
```

### Interpreting Metrics

**Regression models:**
| Metric | Good Value | Description |
|---|---|---|
| R² | > 0.7 | Explained variance (1.0 = perfect) |
| MAE | low | Mean absolute error |
| RMSE | low | Root mean squared error |

**Classification models:**
| Metric | Good Value | Description |
|---|---|---|
| Accuracy | > 0.8 | Overall correct predictions |
| Precision | > 0.7 | Of predicted positives, how many are correct |
| Recall | > 0.7 | Of actual positives, how many were found |
| F1 | > 0.7 | Harmonic mean of precision & recall |

## Step 5: Feature Importance

```qlik
ImportInput:
LOAD '$(vModelName)' as model_name AUTOGENERATE 1;

FeatureImportances:
LOAD * EXTENSION $(vSseConnection).sklearn_Explain_Importances(ImportInput{model_name});
DROP TABLE ImportInput;
TRACE Feature importances loaded;
```

Use this to understand which features drive predictions. Remove low-importance features to simplify the model.

## Step 6: Predict

### Chart Expression (Real-Time)
```qlik
$(vSseConnection).sklearn_Predict(
    '$(vModelName)',
    AvgDailySales & '|' & SalesVariance & '|' & LeadTimeDays & '|' & Category & '|' & DayOfWeek & '|' & Month
)
```

**Field order must match the feature definition order.**

### Load Script (Bulk)
```qlik
PredictionData:
LOAD
    '$(vModelName)' as model_name,
    ProductID as key,
    AvgDailySales,
    SalesVariance,
    LeadTimeDays,
    Category,
    DayOfWeek,
    Month
RESIDENT FactCurrentProducts;

Predictions:
LOAD * EXTENSION $(vSseConnection).sklearn_Bulk_Predict(PredictionData{model_name, key, AvgDailySales, SalesVariance, LeadTimeDays, Category, DayOfWeek, Month});
DROP TABLE PredictionData;
TRACE Bulk predictions: $(NoOfRows('Predictions')) rows;
```

## Additional sklearn Functions

Beyond the core pipeline above, these functions are available:

### Training & Tuning
| Function | Type | Description |
|---|---|---|
| `sklearn_Setup_Adv` | TENSOR | Advanced setup with metric and dimensionality reduction args |
| `sklearn_Partial_Fit` | TENSOR | Incremental training on new data |
| `sklearn_Set_Param_Grid` | TENSOR | Define hyperparameter grid for optimization |
| `sklearn_Get_Best_Params` | TENSOR | Get best params from grid search cross-validation |
| `sklearn_Calculate_Metrics` | TENSOR | Calculate metrics on new data |
| `sklearn_Get_Confusion_Matrix` | TENSOR | Confusion matrix for classifiers |

### Prediction Variants
| Function | Type | Description |
|---|---|---|
| `sklearn_Predict_Proba` | SCALAR | Predict class probabilities (chart expression) |
| `sklearn_Bulk_Predict_Proba` | TENSOR | Predict class probabilities (load script) |
| `sklearn_Fit_Predict` | SCALAR | Fit + predict in one call (chart, e.g. clustering) |
| `sklearn_Bulk_Fit_Predict` | SCALAR | Fit + predict in one call (load script) |
| `sklearn_Fit_Transform` | TENSOR | Dimensionality reduction (PCA, t-SNE, etc.) |

### Model Management
| Function | Type | Description |
|---|---|---|
| `sklearn_List_Models` | TENSOR | Search saved models by name pattern |
| `sklearn_Get_Features_Expression` | TENSOR | Get Qlik expression for feature concatenation |

### Keras / Sequence Models
| Function | Type | Description |
|---|---|---|
| `Keras_Set_Layers` | TENSOR | Define neural network architecture |
| `Keras_Get_History` | TENSOR | Training history (loss, metrics per epoch) |
| `sklearn_Predict_Sequence` | TENSOR | Sequence prediction (chart) |
| `sklearn_Bulk_Predict_Sequence` | TENSOR | Sequence prediction (load script) |

### Generic Predict (Pre-trained / REST / Keras)
| Function | Type | Description |
|---|---|---|
| `Predict` | SCALAR | Predict with pre-trained model (chart expression) |
| `Bulk_Predict` | TENSOR | Predict with pre-trained model (load script) |
| `Get_Features_Expression` | TENSOR | Get features expression for generic Predict |

## Model Persistence

- Models are saved to disk on the SSE server after `sklearn_Fit`
- They persist across reloads — you don't need to retrain every time
- To retrain: run the full pipeline again (Setup → Features → Fit)
- To use existing model: skip to Predict (the model_name must match)

## Best Practices

1. **Start simple** — Use RandomForest before XGBoost
2. **Check for nulls** — Remove or impute null values in training data
3. **Encode categoricals** — Use `one_hot_encoding` for string features
4. **Review metrics** — Don't deploy a model with R² < 0.5
5. **Check feature importance** — Remove irrelevant features
6. **Test with known data** — Predict on historical data and compare
7. **Retrain regularly** — Set up periodic retraining (weekly/monthly)
8. **Version your models** — Use descriptive model names: `reorder_v2_xgb`

[See assets/sklearn-full-pipeline.qlik for the complete pipeline template]
[See assets/bulk-predict-template.qlik for prediction-only patterns]

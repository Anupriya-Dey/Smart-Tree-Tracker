import pandas as pd
import sys
from datetime import datetime, date
from tsfm.tsfm_public.toolkit.time_series_preprocessor import TimeSeriesPreprocessor
from tsfm.tsfm_public.toolkit.dataset import ForecastDFDataset
from transformers import (
    EarlyStoppingCallback,
    PatchTSTConfig,
    PatchTSTForPrediction,
    Trainer,
    TrainingArguments,
)
from tsfm.tsfm_public.toolkit.util import select_by_index
import json
import multiprocessing  # Add this

def main():
    context_length = 336
    forecast_horizon = 96
    patch_length = 16
    num_workers = 4
    batch_size = 64
    dataset_path = f"sinusoidal_temperature_data.csv"
    timestamp_column = "datetime"

    data = pd.read_csv(
        dataset_path,
        parse_dates=[timestamp_column],
    )
    id_columns = []
    forecast_columns = [col for col in data.columns if col != timestamp_column]

    train_start_index = 0  
    train_end_index = int(len(data) * 0.6)
    valid_start_index = train_end_index - 336
    valid_end_index = train_end_index + int(len(data) * 0.20)
    test_start_index = valid_end_index - 336
    test_end_index = valid_end_index + int(len(data) * 0.20)

    train_data = select_by_index(data, id_columns=id_columns, start_index=train_start_index, end_index=train_end_index)
    valid_data = select_by_index(data, id_columns=id_columns, start_index=valid_start_index, end_index=valid_end_index)
    test_data = select_by_index(data, id_columns=id_columns, start_index=test_start_index, end_index=test_end_index)

    time_series_preprocessor = TimeSeriesPreprocessor(
        timestamp_column=timestamp_column,
        id_columns=id_columns,
        target_columns=forecast_columns,
        scaling=True,
    )
    time_series_preprocessor = time_series_preprocessor.train(train_data)

    train_dataset = ForecastDFDataset(
        time_series_preprocessor.preprocess(train_data),
        id_columns=id_columns,
        target_columns=forecast_columns,
        context_length=context_length,
        prediction_length=forecast_horizon,
    )
    valid_dataset = ForecastDFDataset(
        time_series_preprocessor.preprocess(valid_data),
        id_columns=id_columns,
        target_columns=forecast_columns,
        context_length=context_length,
        prediction_length=forecast_horizon,
    )
    test_dataset = ForecastDFDataset(
        time_series_preprocessor.preprocess(test_data),
        id_columns=id_columns,
        target_columns=forecast_columns,
        context_length=context_length,
        prediction_length=forecast_horizon,
    )

    config = PatchTSTConfig(
        num_input_channels=len(forecast_columns),
        context_length=context_length,
        patch_length=patch_length,
        patch_stride=patch_length,
        prediction_length=forecast_horizon,
        random_mask_ratio=0.4,
        d_model=128,
        num_attention_heads=16,
        num_hidden_layers=2,
        ffn_dim=256,
        dropout=0.2,
        head_dropout=0.2,
        pooling_type=None,
        channel_attention=False,
        scaling="std",
        loss="mse",
        pre_norm=True,
        norm_type="batchnorm",
    )

    model = PatchTSTForPrediction(config)
    training_args = TrainingArguments(
        output_dir="./working/checkpoint/patchtst/custom/pretrain/output/",
        overwrite_output_dir=True,
        learning_rate=0.001,
        num_train_epochs=15,
        do_eval=True,
        eval_strategy="epoch",
        per_device_train_batch_size=batch_size,
        per_device_eval_batch_size=batch_size,
        dataloader_num_workers=num_workers,
        save_strategy="epoch",
        logging_strategy="epoch",
        save_total_limit=3,
        logging_dir="./working/checkpoint/patchtst/custom/pretrain/logs/",
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        label_names=["future_values"],
    )

    early_stopping_callback = EarlyStoppingCallback(
        early_stopping_patience=10,
        early_stopping_threshold=0.0001,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=valid_dataset,
        callbacks=[early_stopping_callback],
    )

    trainer.train()
    trainer.save_model("./saved_patchtst_model")
    print("Model saved to ./saved_patchtst_model")
    
    # model = PatchTSTForPrediction.from_pretrained("./saved_patchtst_model")

    print("Making prediction...")
    prediction = trainer.predict(test_dataset)
    print(prediction)
    
    all_predictions = prediction.predictions[1].squeeze(-1).tolist()  # shape: (905, 96)

    with open("full_predictions_905x96.json", "w") as f:
        json.dump(all_predictions, f, indent=2)

    print("All predictions (905x96) saved to full_predictions_905x96.json")

        # All 905 samples, shape: (905, 96, 1)
    predicted_array = prediction.predictions[1]

    # Remove the last dimension (1), now shape: (905, 96)
    predicted_values = predicted_array[:, :, 0]

    # Scale back the full array
    original_scale = predicted_values * temp_std + temp_mean

    # Convert to list of lists
    original_scale_list = original_scale.tolist()

    # Save each 96-value row to a file
    with open("scaled_predictions_all.json", "w") as f:
        json.dump(original_scale_list, f)

    print("All scaled predictions saved with 96 values per row.")

    print("Scaled-back Temperatures:", original_scale)
    print("JSON Output:\n", json.dumps(original_scale), flush=True)

    output_file = f'prediction_output.json'
    with open(output_file, 'w') as f:
        json.dump(original_scale, f)

    print("Prediction saved to prediction_output.json", flush=True)


if __name__ == '__main__':
    multiprocessing.freeze_support()  # Safe for Windows
    main()

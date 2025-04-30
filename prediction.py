import pandas as pd
import sys
from datetime import datetime, date
from tsfm.tsfm_public.toolkit.time_series_preprocessor import TimeSeriesPreprocessor
from tsfm.tsfm_public.toolkit.dataset import ForecastDFDataset
from transformers import(
    PatchTSTForPrediction,
    Trainer,
)
import json


# Constants
context_length = 512
pred_length = 96
raw_input = sys.argv[1]
raw_records = json.loads(raw_input)  # List of dicts like [{"12:00:01": 24.5}, ...]
sensor_type = sys.argv[2]  # 'Temperature' or 'Pressure'


records = []
for item in raw_records:
    try:
        key = list(item.keys())[0]
        value = item[key]
        # time_obj = datetime.strptime(key, "%H:%M:%S")
        # combined_datetime = datetime.combine(date.today(), time_obj.time())
        # records.append({"date": combined_datetime, "Temperature": value})
        
        datetime_obj = datetime.strptime(key, "%Y-%m-%d %H:%M:%S")
        records.append({"date": datetime_obj, "Temperature": value})
    except Exception as e:
        print("Skipping invalid item:", item, e)

# Create DataFrame
df = pd.DataFrame(records)

timestamp_column = "date"
id_columns = []
forecast_columns = ["Temperature"] 

tsp = TimeSeriesPreprocessor(
    timestamp_column="date",
    id_columns=[],
    # target_columns=["Temperature"],
    target_columns=forecast_columns,
    scaling=True,
)
tsp.train(df)  
processed_df = tsp.preprocess(df)

test_dataset = ForecastDFDataset(
    processed_df,
    id_columns=[],
    # target_columns=["Temperature"],
    target_columns=forecast_columns,
    context_length=context_length,         # Your input sequence length
    prediction_length=pred_length,       # Predict just the next value
)

print("Loading pretrained model")
model = PatchTSTForPrediction.from_pretrained("ibm-granite/granite-timeseries-patchtst", num_input_channels=1, context_length=context_length, prediction_length=pred_length)
print("Model loaded")

trainer = Trainer(model=model)
print("Making prediction...")
prediction = trainer.predict(test_dataset)
print(prediction)

predicted_array = prediction.predictions[1]  # shape: (1, pred_length, num_channels)
predicted_values = predicted_array[0][:, 0]  # Only Temperature channel

# Fetch mean and std from tsp
temp_mean = df["Temperature"].mean()
temp_std = df["Temperature"].std()
print("Mean:", temp_mean, "Std Dev:", temp_std)

# Inverse transform (z * std + mean)
original_scale = predicted_values * temp_std + temp_mean
original_scale = original_scale.tolist()

# Print
print("Scaled-back Temperatures:", original_scale)

print("JSON Output:\n", json.dumps(original_scale), flush=True)

output_file = f'prediction_output_{sensor_type}.json'

# Write predictions to the file
with open(output_file, 'w') as f:
    json.dump(original_scale, f)

print("Prediction saved to prediction_output.json", flush=True)
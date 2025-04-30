import pandas as pd
import sys
from datetime import datetime, date

import numpy as np
import json
# import matplotlib.pyplot as plt
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense

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
test_df = pd.DataFrame(records)

# --- Parameters ---
sequence_length = 10    # How many past values to use for prediction
predict_length = 100    # Can be changed to 25, 40, or 50
filename = 'sawtooth_temparature_data.csv'

# --- Load and Normalize Data ---
df = pd.read_csv(filename)
temps = df['Temperature'].values.reshape(-1, 1)

scaler = MinMaxScaler()
temps_scaled = scaler.fit_transform(temps)

# --- Create sequences ---
X, y = [], []
for i in range(len(temps_scaled) - sequence_length - predict_length + 1):
    X.append(temps_scaled[i:i + sequence_length])
    y.append(temps_scaled[i + sequence_length:i + sequence_length + predict_length])

X, y = np.array(X), np.array(y)

# --- Train/Test Split ---
split = int(1 * len(X))
X_train, X_test = X[:split], X[split:]
y_train, y_test = y[:split], y[split:]

# --- Build Model ---
model = Sequential([
    LSTM(64, return_sequences=False, input_shape=(sequence_length, 1)),
    Dense(predict_length)
])

model.compile(optimizer='adam', loss='mse')
model.fit(X_train, y_train, epochs=20, batch_size=32, validation_split=0.1)

# --- Prediction --
last_seq = test_df[-sequence_length:]
# Ensure only temperature values are passed
if isinstance(last_seq, pd.DataFrame):
    last_seq = last_seq[['Temperature']].values
elif isinstance(last_seq, list):
    # last_seq is a list of dicts like [{time1: val1}, {time2: val2}, ...]
    last_seq = np.array([list(d.values())[0] for d in last_seq]).reshape(-1, 1)
    
last_seq = scaler.transform(last_seq)
last_seq = last_seq.reshape(1, sequence_length, 1)
# print(last_seq.shape)  # Check the shape of last_seq
# print(last_seq)
predicted_scaled = model.predict(last_seq)

predicted = scaler.inverse_transform(predicted_scaled.reshape(-1, 1))

# --- Save prediction to JSON ---
predicted_list = predicted.flatten().tolist()  # Convert to plain Python list
output_json = predicted_list

with open("prediction_output_Temperature.json", "w") as f:
    json.dump(output_json, f, indent=2)

print("Predicted temperatures saved to prediction_output_Temperature.json")
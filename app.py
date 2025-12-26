import pandas as pd
from prophet import Prophet
from flask import Flask, jsonify, render_template
app = Flask(__name__)
 
dataSet = pd.read_csv("dataset/salesdataset.csv", encoding='latin1')
# print(dataSet.columns)
 
# pandas default time assumption: mm/dd/yyyy so add --> errors='coerce'
dataSet['Order Date'] = pd.to_datetime(dataSet['Order Date'],errors='coerce')
# from the dataset take out order date and store it in a new variable
dataSet['year'] = dataSet['Order Date'].dt.year
# if year is not defined then drop those
dataSet = dataSet.dropna(subset=['year'])
 
# create a monthly date column
dataSet['month'] = dataSet['Order Date'].dt.to_period('M')
# monthly sales
monthly_sales = dataSet.groupby('month')['Sales'].sum().reset_index()
# print(monthly_sales)
prophet_df=monthly_sales.rename(
    columns={'month':'ds','Sales':'y'}
)
prophet_df['ds'] = prophet_df['ds'].dt.to_timestamp()
 
# train data from 21 to 23
train_dataSet=prophet_df[(prophet_df['ds'].dt.year>=2021) & (prophet_df['ds'].dt.year<=2023)]
 
#test data for 2024
test_dataSet = prophet_df[prophet_df['ds'].dt.year==2024]
 
# create and train the model
model= Prophet()
model.add_country_holidays(country_name='US')
model.fit(train_dataSet)
 
# predict for 2024
future_2024 = model.make_future_dataframe(periods=12,freq='MS')
forecast_2024 = model.predict(future_2024)
pred_2024 = forecast_2024[forecast_2024['ds'].dt.year == 2024]
 
y_true = test_dataSet['y'].values
y_pred = pred_2024['yhat'].values
 
 
 
# final model
final_model = Prophet()
final_model.fit(prophet_df[prophet_df['ds'].dt.year<=2024])
 
# predict for future
future_2025 = final_model.make_future_dataframe(periods=12, freq='MS')
forecast_2025 = final_model.predict(future_2025)
pred_2025 = forecast_2025[forecast_2025['ds'].dt.year == 2025]
 
 
# ------------------------------------------------------------------------------------------------------------
 
last_3_years = dataSet[dataSet['year'].isin([2022, 2023, 2024])]
 
subcat_sales_3y = (
    last_3_years
    .groupby('Sub-Category')['Sales']
    .sum()
    .reset_index()
    .sort_values(by='Sales', ascending=False)
)
 
# Percentage contribution
subcat_sales_3y['percentage'] = (
    subcat_sales_3y['Sales'] / subcat_sales_3y['Sales'].sum() * 100
)
subcat_2024 = (
    dataSet[dataSet['year'] == 2024]
    .groupby('Sub-Category')['Sales']
    .sum()
    .reset_index()
    .sort_values(by='Sales', ascending=False)
)
total_2025_sales = pred_2025['yhat'].sum()
 
subcat_2025_prediction = subcat_sales_3y.copy()
subcat_2025_prediction['predictedSales2025'] = (
    subcat_2025_prediction['percentage'] / 100 * total_2025_sales
)
 
subcat_2025_prediction = subcat_2025_prediction.sort_values(
    by='predictedSales2025', ascending=False
)
 
comparison = subcat_2025_prediction.merge(
    subcat_2024,
    on='Sub-Category',
    how='left',
    suffixes=('_2025', '_2024')
)
 
comparison['growth'] = (
    (comparison['predictedSales2025'] - comparison['Sales_2024'])
    / comparison['Sales_2024'] * 100
)
 
 
@app.route('/')
def index():
    return render_template('index.html')
 
# total sales
@app.route('/sales/<int:year>')
def get_total_sales(year):
 
    # -------- Actual quarterly sales (from test dataset) --------
    actual_df = test_dataSet.copy()
    actual_df['quarter'] = actual_df['ds'].dt.to_period('Q').dt.to_timestamp()
 
    quarterly_actual = (
        actual_df
        .groupby('quarter')['y']
        .sum()
        .reset_index()
        .rename(columns={'quarter': 'ds', 'y': 'actualSales'})
    )
 
    # -------- Actual quarterly profit --------
    profit_df = dataSet[dataSet['year'] == year].copy()
    profit_df['quarter'] = profit_df['Order Date'].dt.to_period('Q').dt.to_timestamp()
 
    quarterly_profit = (
        profit_df
        .groupby('quarter')['Profit']
        .sum()
        .reset_index()
        .rename(columns={'quarter': 'ds', 'Profit': 'actualProfit'})
    )
 
    # -------- Predicted quarterly sales --------
    predicted_df = pred_2024.copy()
    predicted_df['quarter'] = predicted_df['ds'].dt.to_period('Q').dt.to_timestamp()
 
    quarterly_predicted = (
        predicted_df
        .groupby('quarter')['yhat']
        .sum()
        .reset_index()
        .rename(columns={'quarter': 'ds', 'yhat': 'predictedSales'})
    )
 
    # -------- Merge actual, predicted, profit --------
    quarterly_df = quarterly_actual.merge(
        quarterly_predicted, on='ds', how='inner'
    ).merge(
        quarterly_profit, on='ds', how='left'
    )
 
    # -------- Error calculation --------
    quarterly_df['absoluteError'] = abs(
        quarterly_df['actualSales'] - quarterly_df['predictedSales']
    )
    quarterly_df['errorPercentage'] = (
        quarterly_df['absoluteError'] / quarterly_df['actualSales'] * 100
    )
 
    # -------- Yearly totals --------
    total_actual = quarterly_df['actualSales'].sum()
    total_predicted = quarterly_df['predictedSales'].sum()
    total_profit = quarterly_df['actualProfit'].sum()
    total_error = abs(total_actual - total_predicted)
    total_error_pct = (total_error / total_actual) * 100 if total_actual != 0 else None
 
    # -------- JSON response --------
    return jsonify({
        "year": year,
        "yearlySummary": {
            "totalActualSales": float(total_actual),
            "totalPredictedSales": float(total_predicted),
            "totalProfit": float(total_profit),
            "totalAbsoluteError": float(total_error),
            "totalErrorPercentage": round(total_error_pct, 2) if total_error_pct else None
        },
        "quarterlyBreakdown": quarterly_df.to_dict(orient='records')
    })
 
# predicted sales
@app.route('/predict/<int:year>')
def get_predicted_sales(year):
    forecast_2025 = pred_2025[pred_2025['ds'].dt.year==year].copy()
    predection = forecast_2025[['ds','yhat']].to_dict(orient='records')
    forecast_2025.rename(columns={'yhat': 'predictedSales'}, inplace=True)
    total_predicted = forecast_2025['predictedSales'].sum()
 
    return jsonify({
        "year":year,
        "predicted":predection,
        "totalPredictedSales": float(total_predicted)
 
    })
 
 
# ---------------------------------------------------------------------------
def campaign_type(growth):
    if growth > 15:
        return "High Growth, Push Ads"
    elif growth > 0:
        return "Stable, Retarget"
    else:
        return "Low Demand, Discount"
 
comparison['campaignSuggestion'] = comparison['growth'].apply(campaign_type)
 
@app.route('/sub-category')
def sub_category_forecast():
    return jsonify(
        comparison[[
            'Sub-Category',
            'Sales_2024',
            'predictedSales2025',
            'growth',
            'campaignSuggestion'
        ]].to_dict(orient='records')
    )

if __name__ == "__main__":
    app.run(debug=True, port=5001)
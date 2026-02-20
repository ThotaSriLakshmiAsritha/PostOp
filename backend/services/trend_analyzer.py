import pandas as pd
import numpy as np

def calculate_trend_slope(logs, field_name):
    """
    Calculates the slope of a given field from a list of logs.
    Expects logs to be sorted by timestamp.
    """
    if len(logs) < 2:
        return 0
    
    values = [float(log.get(field_name, 0)) for log in logs]
    y = np.array(values)
    x = np.arange(len(y))
    
    # Linear regression to find slope
    slope, intercept = np.polyfit(x, y, 1)
    return slope

class TrendAnalyzer:
    def analyze(self, historical_logs):
        """
        Analyzes historical logs for increasing trends.
        """
        if not historical_logs or len(historical_logs) < 3:
            return 0  # Not enough data for trend
            
        # Analyze last 3-5 logs
        recent_logs = historical_logs[-5:]
        
        pain_slope = calculate_trend_slope(recent_logs, 'pain_score')
        temp_slope = calculate_trend_slope(recent_logs, 'temperature')
        
        # If pain is increasing sharply (slope > 0.5)
        if pain_slope > 0.5:
            return 1 # Yellow escalation
        
        # If temp is increasing sharply
        if temp_slope > 0.2:
            return 1
            
        return 0

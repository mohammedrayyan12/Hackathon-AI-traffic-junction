"""
Traffic Signal Priority Logic
Computes green signal order and durations using weighted vehicle counts.
"""
from typing import Dict

# Define the weights for each vehicle type
WEIGHTS = {
    "car": 1.0,
    "motorcycle": 0.5,
    "bus": 3.0,
    "truck": 2.5,
    "emergency": 100.0  # High priority for emergency vehicles
}

def compute_signal_priority(junctions: dict) -> dict:
    """
    Compute priority based on weighted vehicle counts.
    Handles both simple counts (int) and detailed breakdowns (dict).
    """
    if not junctions:
        return {"error": "No junction data provided"}

    # Check for the special case where all junctions have an emergency vehicle
    emergency_junctions = [name for name, data in junctions.items() if isinstance(data, dict) and data.get("emergency", 0) > 0]
    if len(emergency_junctions) > 1 and len(emergency_junctions) == len(junctions):
        # If all junctions have an emergency vehicle, trigger an all-green override
        all_green_duration = 30 # Short, equal duration for all
        return {
            "green_junction": "ALL",
            "priority_order": list(junctions.keys()),
            "green_durations": {name: all_green_duration for name in junctions},
            "weights": {name: 100 for name in junctions}, # Max weight for all
            "vehicle_counts": junctions,
            "cycle_duration": 120,
            "special_case": "ALL_GREEN_EMERGENCY"
        }

    weighted_counts = {}
    for name, data in junctions.items():
        # Check if data is a detailed dictionary or a simple integer
        if isinstance(data, dict):
            # Calculate score from detailed counts (new manual form & upload)
            w = sum(data.get(v_type, 0) * WEIGHTS.get(v_type, 1.0) for v_type in data)
            weighted_counts[name] = round(w, 2)
        elif isinstance(data, int):
            # Fallback for old manual mode (treat as cars)
            weighted_counts[name] = data * WEIGHTS["car"]

    total_weight = sum(weighted_counts.values()) or 1
    priority_order = sorted(weighted_counts, key=weighted_counts.get, reverse=True)

    CYCLE_DURATION = 120
    green_durations = {
        name: round((weighted_counts[name] / total_weight) * CYCLE_DURATION if total_weight > 0 else 30)
        for name in priority_order
    }

    return {
        "green_junction": priority_order[0] if priority_order else "None",
        "priority_order": priority_order,
        "green_durations": green_durations,
        "weights": weighted_counts,
        "vehicle_counts": junctions,
        "cycle_duration": CYCLE_DURATION,
    }

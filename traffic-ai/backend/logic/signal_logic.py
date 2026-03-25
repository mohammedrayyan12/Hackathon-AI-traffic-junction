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

def compute_signal_priority(junctions: dict, current_green: str = None, vehicle_passed: bool = False) -> dict:
    """
    Compute priority based on weighted vehicle counts and current state.
    """
    if not junctions:
        return {"error": "No junction data provided"}

    # Calculate weighted counts
    weighted_counts = {}
    for name, data in junctions.items():
        if isinstance(data, dict):
            w = sum(data.get(v_type, 0) * WEIGHTS.get(v_type, 1.0) for v_type in data)
            weighted_counts[name] = round(w, 2)
        elif isinstance(data, int):
            weighted_counts[name] = data * WEIGHTS["car"]

    # Determine priority order
    priority_order = sorted(weighted_counts, key=weighted_counts.get, reverse=True)
    
    # If a vehicle has passed, the current green light should turn red
    if vehicle_passed and current_green:
        # The next green light is the next in the priority order
        current_index = priority_order.index(current_green)
        next_green_index = (current_index + 1) % len(priority_order)
        next_green = priority_order[next_green_index]
    else:
        # Otherwise, the green light is the one with the highest priority
        next_green = priority_order[0] if priority_order else "None"

    # Set green durations
    total_weight = sum(weighted_counts.values()) or 1
    CYCLE_DURATION = 120
    green_durations = {
        name: round((weighted_counts[name] / total_weight) * CYCLE_DURATION if total_weight > 0 else 30)
        for name in priority_order
    }

    return {
        "green_junction": next_green,
        "priority_order": priority_order,
        "green_durations": green_durations,
        "weights": weighted_counts,
        "vehicle_counts": junctions,
        "cycle_duration": CYCLE_DURATION,
    }

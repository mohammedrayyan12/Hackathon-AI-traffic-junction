from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from model.yolo_model import detect_vehicles
from logic.signal_logic import compute_signal_priority
from utils.video_utils import extract_frames

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), '..', 'uploads')
OUTPUT_FOLDER = os.path.join(os.path.dirname(__file__), '..', 'outputs')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

@app.route('/api/manual', methods=['POST'])
def manual_input():
    """
    Accepts manual vehicle counts per junction lane.
    Expected JSON: { "junctions": { "North": 12, "South": 8, "East": 15, "West": 5, "NorthEast": 3 } }
    """
    data = request.get_json()
    junctions = data.get('junctions', {})
    result = compute_signal_priority(junctions)
    return jsonify(result)


@app.route('/api/upload', methods=['POST'])
def upload_input():
    """
    Accepts image or video files for each junction.
    Form fields: files[] (images/video), junction_names[] (matching order)
    """
    files = request.files.getlist('files[]')
    junction_names = request.form.getlist('junction_names[]')
    junctions = {}

    for i, file in enumerate(files):
        junction_name = junction_names[i] if i < len(junction_names) else f"Junction_{i}"
        filename = f"{junction_name}_{file.filename}"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)

        ext = file.filename.rsplit('.', 1)[-1].lower()
        if ext in ['mp4', 'avi', 'mov', 'mkv']:
            frames = extract_frames(filepath, max_frames=5)
            counts = [detect_vehicles(frame) for frame in frames]
            vehicle_count = int(sum(counts) / len(counts)) if counts else 0
        else:
            vehicle_count = detect_vehicles(filepath)

        junctions[junction_name] = vehicle_count

    result = compute_signal_priority(junctions)
    return jsonify(result)


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"})


if __name__ == '__main__':
    app.run(debug=True, port=5001)

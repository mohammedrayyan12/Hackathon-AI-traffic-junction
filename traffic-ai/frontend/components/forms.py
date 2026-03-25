import streamlit as st
import requests


def manual_form(backend_url: str, junction_names: list):
    st.subheader("✏️ Manual Vehicle Counts")
    
    # Define vehicle types matching backend logic
    vehicle_types = {
        "Cars": "car",
        "Bikes": "motorcycle",
        "Buses": "bus",
        "Trucks": "truck",
        "Ambulances": "emergency"
    }

    junction_data = {}

    for name in junction_names:
        with st.expander(f"📍 {name} Junction"):
            counts = {}
            cols = st.columns(len(vehicle_types))
            i = 0
            for display_name, key_name in vehicle_types.items():
                with cols[i]:
                    counts[key_name] = st.number_input(f"{display_name}", min_value=0, value=0, step=1, key=f"{name}_{key_name}")
                i += 1
            junction_data[name] = counts

    if st.button("🚀 Analyze & Update Dashboard"):
        payload = {"junctions": junction_data}
        try:
            resp = requests.post(f"{backend_url}/api/manual", json=payload, timeout=10)
            st.session_state.analysis_result = resp.json()
            st.rerun()
        except Exception as e:
            st.error(f"Backend error: {e}")


def upload_form(backend_url: str, junction_names: list):
    st.subheader("Upload Images or Videos per Junction")
    uploaded = {}
    for name in junction_names:
        f = st.file_uploader(f"{name} Junction", type=["jpg", "jpeg", "png", "mp4", "avi", "mov"], key=name)
        if f:
            uploaded[name] = f

    if st.button("🚀 Detect & Analyze") and uploaded:
        files = [("files[]", (name, uploaded[name], uploaded[name].type)) for name in uploaded]
        data = [("junction_names[]", name) for name in uploaded]
        try:
            resp = requests.post(f"{backend_url}/api/upload", files=files, data=data, timeout=30)
            st.session_state.analysis_result = resp.json()
            st.rerun()
        except Exception as e:
            st.error(f"Backend error: {e}")


def display_result(result: dict):
    if "error" in result:
        st.error(result["error"])
        return

    st.success(f"✅ Green Signal → **{result['green_junction']}** Junction")
    st.subheader("Priority Order")
    for i, name in enumerate(result["priority_order"], 1):
        bar_len = int(result["weights"][name])
        count = result["vehicle_counts"][name]
        dur = result["green_durations"][name]
        st.markdown(f"**{i}. {name}** — {count} vehicles | {dur}s green | weight: {result['weights'][name]}")
        st.progress(min(bar_len / 30, 1.0))

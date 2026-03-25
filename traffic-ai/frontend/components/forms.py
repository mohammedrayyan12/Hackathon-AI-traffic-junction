import streamlit as st
import requests


def manual_form(backend_url: str, junction_names: list):
    st.markdown("#### ✏️ Manual Input")
    
    # Define vehicle types with icons
    vehicle_types = {
        "🚗 Cars": "car",
        "🏍️ Bikes": "motorcycle",
        "🚌 Buses": "bus",
        "🚛 Trucks": "truck",
        "🚑 Emergency": "emergency"
    }

    junction_data = {}

    for name in junction_names:
        with st.expander(f"📍 {name} Junction", expanded=(name == "North")):
            counts = {}
            for display_name, key_name in vehicle_types.items():
                counts[key_name] = st.slider(
                    display_name, 
                    min_value=0, 
                    max_value=50, 
                    value=0, 
                    key=f"{name}_{key_name}"
                )
            junction_data[name] = counts

    st.markdown("<br>", unsafe_allow_html=True)
    if st.button("🚀 Analyze & Optimize"):
        # Get current state from session
        current_state = st.session_state.get("analysis_result", {})
        current_green = current_state.get("green_junction")
        
        # In a real app, this would be triggered by a sensor
        vehicle_passed = True

        payload = {
            "junctions": junction_data,
            "current_green": current_green,
            "vehicle_passed": vehicle_passed
        }
        with st.spinner("Optimizing Traffic Flow..."):
            try:
                resp = requests.post(f"{backend_url}/api/manual", json=payload, timeout=10)
                st.session_state.analysis_result = resp.json()
                st.rerun()
            except Exception as e:
                st.error(f"Backend error: {e}")

    # Display results in the sidebar if available
    if "analysis_result" in st.session_state:
        st.markdown("---")
        display_result(st.session_state.analysis_result)


def upload_form(backend_url: str, junction_names: list):
    st.markdown("#### 📷 Visual Analysis")
    uploaded = {}
    for name in junction_names:
        f = st.file_uploader(f"{name} Junction", type=["jpg", "jpeg", "png", "mp4", "avi", "mov"], key=name)
        if f:
            uploaded[name] = f

    st.markdown("<br>", unsafe_allow_html=True)
    if st.button("🚀 Run AI Detection") and uploaded:
        files = [("files[]", (name, uploaded[name], uploaded[name].type)) for name in uploaded]
        data = [("junction_names[]", name) for name in uploaded]
        with st.spinner("Processing Visual Data..."):
            try:
                resp = requests.post(f"{backend_url}/api/upload", files=files, data=data, timeout=30)
                st.session_state.analysis_result = resp.json()
                st.rerun()
            except Exception as e:
                st.error(f"Backend error: {e}")

    # Display results in the sidebar if available
    if "analysis_result" in st.session_state:
        st.markdown("---")
        display_result(st.session_state.analysis_result)


def display_result(result: dict):
    if "error" in result:
        st.error(result["error"])
        return

    st.markdown(f"""
        <div style="background: rgba(34, 197, 94, 0.1); padding: 1rem; border-radius: 12px; border: 1px solid rgba(34, 197, 94, 0.2); margin-bottom: 1.5rem;">
            <p style="color: #22C55E; margin: 0; font-size: 0.8rem; text-transform: uppercase; font-weight: 600;">Active Signal</p>
            <h3 style="color: #E5E7EB; margin: 0;">{result['green_junction']} Junction</h3>
        </div>
    """, unsafe_allow_html=True)

    st.markdown("##### Priority Queue")
    for i, name in enumerate(result["priority_order"], 1):
        weight = result["weights"][name]
        dur = result["green_durations"][name]
        
        # Normalize weight for progress bar (assuming max 100 for visual)
        progress = min(weight / 50, 1.0)
        
        st.markdown(f"""
            <div style="margin-bottom: 0.8rem;">
                <div style="display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 0.2rem;">
                    <span>{i}. {name}</span>
                    <span style="color: #3B82F6;">{dur}s</span>
                </div>
            </div>
        """, unsafe_allow_html=True)
        st.progress(progress)


"""
Traffic AI - Streamlit Frontend
Connects to Flask backend for vehicle detection and signal priority.
"""
import streamlit as st
import requests
import json
import os
from components.forms import manual_form, upload_form
from simulation import show_simulation

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:5001")

st.set_page_config(page_title="Traffic AI Signal Control", layout="wide", page_icon="🚦")

st.title("🚦 JunctionAI — Adaptive Traffic Control")

JUNCTION_NAMES = ["North", "South", "East", "West"]

# Create Two Main Columns with better spacing
col_input, col_sim = st.columns([1, 2.5], gap="medium")

with col_input:
    st.subheader("🛠️ Junction Control")
    mode = st.radio("Input Mode", ["✏️ Manual", "📷 Upload"], horizontal=True)
    
    if mode == "✏️ Manual":
        manual_form(BACKEND_URL, JUNCTION_NAMES)
    else:
        upload_form(BACKEND_URL, JUNCTION_NAMES)

with col_sim:
    if "analysis_result" in st.session_state:
        show_simulation(st.session_state.analysis_result)
    else:
        st.info("👈 Enter traffic data on the left to start the 3D Simulation.")
        st.image("https://images.unsplash.com/photo-1545147418-919d651d9846?auto=format&fit=crop&q=80&w=800", caption="Waiting for traffic analysis...")

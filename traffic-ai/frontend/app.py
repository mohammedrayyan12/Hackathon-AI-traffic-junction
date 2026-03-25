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

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:5002")

st.set_page_config(
    page_title="JunctionAI — Smart Traffic Control",
    layout="wide",
    page_icon="🚦",
    initial_sidebar_state="expanded"
)

# --- Premium Theme CSS ---
st.markdown("""<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    
    .stApp {
        background-color: #0B0F19;
        color: #E5E7EB;
        font-family: 'Inter', sans-serif;
    }

    [data-testid="stSidebar"] {
        background-color: #0F172A;
        border-right: 1px solid rgba(255, 255, 255, 0.05);
    }
    
    [data-testid="stSidebar"] .stMarkdown h3 {
        color: #3B82F6;
    }

    /* Glassmorphism cards */
    .stExpander {
        background: rgba(17, 24, 39, 0.4);
        backdrop-filter: blur(10px);
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .main-title {
        font-size: 2.8rem;
        font-weight: 800;
        background: linear-gradient(135deg, #3B82F6 0%, #22D3EE 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }
    
    .sub-title {
        color: #9CA3AF;
        margin-bottom: 2rem;
    }

    .stButton > button {
        background: linear-gradient(90deg, #3B82F6, #2563EB);
        color: white;
        border-radius: 12px;
        border: none;
        font-weight: 600;
        width: 100%;
    }
    
    .stButton > button:hover {
        transform: translateY(-2px);
        color: white;
    }

    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    header {visibility: hidden;}
</style>""", unsafe_allow_html=True)

st.markdown('<h1 class="main-title">🚦 JunctionAI</h1>', unsafe_allow_html=True)
st.markdown('<p class="sub-title">Premium Adaptive Traffic Control System</p>', unsafe_allow_html=True)

JUNCTION_NAMES = ["North", "South", "East", "West"]

# Sidebar for controls
with st.sidebar:
    st.markdown("### 🛠️ System Control")
    mode = st.radio("Input Mode", ["✏️ Manual", "📷 Upload"], horizontal=True, label_visibility="collapsed")
    
    st.markdown("---")
    
    if mode == "✏️ Manual":
        manual_form(BACKEND_URL, JUNCTION_NAMES)
    else:
        upload_form(BACKEND_URL, JUNCTION_NAMES)

# Main Simulation Area
result_data = st.session_state.get("analysis_result", {})
show_simulation(result_data)

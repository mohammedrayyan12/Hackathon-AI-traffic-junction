import streamlit as st
import streamlit.components.v1 as components
import json

def show_simulation(result_data: dict):
    """
    Renders the 2D Junction Simulation with realistic roads and lights.
    """
    result_json = json.dumps(result_data)
    
    html_code = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ 
                margin: 0; 
                background: transparent; 
                overflow: hidden;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
            }}
            canvas {{ 
                display: block; 
                background: #0B0F19; 
                border-radius: 24px; 
                border: 1px solid rgba(255, 255, 255, 0.05);
                box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            }}
        </style>
    </head>
    <body>
        <canvas id="simCanvas" width="1000" height="700"></canvas>
        <script>
            const canvas = document.getElementById('simCanvas');
            const ctx = canvas.getContext('2d');
            const W = canvas.width, H = canvas.height;
            const resultData = {result_json};

            // --- Premium Configuration ---
            const ROAD_WIDTH = 220;
            const LANE_WIDTH = ROAD_WIDTH / 2;
            const STOP_DIST = 70;
            const COLORS = {{
                road: '#1E293B',
                marking: 'rgba(255, 255, 255, 0.2)',
                centerLine: '#3B82F6',
                zebra: 'rgba(255, 255, 255, 0.1)',
                red: '#EF4444',
                green: '#22C55E',
                signalBox: '#0F172A'
            }};
            
            const V_CONFIG = {{
                'car': {{ color: '#3B82F6', w: 22, h: 14, speed: 2 }},
                'motorcycle': {{ color: '#22D3EE', w: 14, h: 8, speed: 2.5 }},
                'bus': {{ color: '#8B5CF6', w: 40, h: 20, speed: 1.5 }},
                'truck': {{ color: '#F59E0B', w: 36, h: 18, speed: 1.6 }},
                'emergency': {{ color: '#EF4444', w: 24, h: 16, speed: 3.5, siren: true }}
            }};

            let vehicles = [];
            let initialized = false;

            class Vehicle {{
                constructor(junction, type) {{
                    this.junction = junction;
                    this.type = type;
                    const cfg = V_CONFIG[type] || V_CONFIG.car;
                    this.color = cfg.color;
                    this.w = cfg.w;
                    this.h = cfg.h;
                    this.speed = cfg.speed + (Math.random() * 0.5);
                    this.siren = cfg.siren || false;
                    this.sirenFrame = 0;
                    this.opacity = 0; // For fade-in effect

                    // Initial Positions (Centered in lanes)
                    if (junction === 'North') {{ this.x = W/2 - LANE_WIDTH/2 + 15; this.y = -Math.random()*1000; this.dir = 'V'; this.sign = 1; }}
                    if (junction === 'South') {{ this.x = W/2 + LANE_WIDTH/2 - 35; this.y = H + Math.random()*1000; this.dir = 'V'; this.sign = -1; }}
                    if (junction === 'East')  {{ this.x = W + Math.random()*1000; this.y = H/2 - LANE_WIDTH/2 + 15; this.dir = 'H'; this.sign = -1; }}
                    if (junction === 'West')  {{ this.x = -Math.random()*1000; this.y = H/2 + LANE_WIDTH/2 - 35; this.dir = 'H'; this.sign = 1; }}
                }}

                update() {{
                    if (this.opacity < 1) this.opacity += 0.05;
                    
                    const active = resultData.green_junction;
                    const isGreen = (active === this.junction) || (resultData.special_case === 'ALL_GREEN_EMERGENCY');
                    
                    let canMove = true;
                    if (!isGreen) {{
                        if (this.junction === 'North' && this.y + this.w > H/2 - ROAD_WIDTH/2 - STOP_DIST && this.y < H/2) canMove = false;
                        if (this.junction === 'South' && this.y < H/2 + ROAD_WIDTH/2 + STOP_DIST && this.y > H/2) canMove = false;
                        if (this.junction === 'East'  && this.x < W/2 + ROAD_WIDTH/2 + STOP_DIST && this.x > W/2) canMove = false;
                        if (this.junction === 'West'  && this.x + this.w > W/2 - ROAD_WIDTH/2 - STOP_DIST && this.x < W/2) canMove = false;
                    }}

                    // Simple collision avoidance
                    vehicles.forEach(other => {{
                        if (other === this) return;
                        if (this.dir === 'V' && other.dir === 'V' && this.x === other.x) {{
                            if (this.sign === 1 && other.y > this.y && other.y < this.y + this.w + 20) canMove = false;
                            if (this.sign === -1 && other.y < this.y && other.y > this.y - other.w - 20) canMove = false;
                        }}
                        if (this.dir === 'H' && other.dir === 'H' && this.y === other.y) {{
                            if (this.sign === 1 && other.x > this.x && other.x < this.x + this.w + 20) canMove = false;
                            if (this.sign === -1 && other.x < this.x && other.x > this.x - other.w - 20) canMove = false;
                        }}
                    }});

                    if (canMove) {{
                        if (this.dir === 'V') this.y += this.speed * this.sign;
                        else this.x += this.speed * this.sign;
                    }}
                }}

                draw() {{
                    ctx.save();
                    ctx.globalAlpha = this.opacity;
                    ctx.fillStyle = this.color;
                    
                    if (this.siren) {{
                        this.sirenFrame++;
                        if (this.sirenFrame % 20 < 10) {{
                            ctx.shadowBlur = 15;
                            ctx.shadowColor = COLORS.red;
                        }} else {{
                            ctx.shadowBlur = 15;
                            ctx.shadowColor = '#3B82F6';
                        }}
                    }} else {{
                        ctx.shadowBlur = 5;
                        ctx.shadowColor = 'rgba(0,0,0,0.5)';
                    }}

                    // Draw vehicle as rounded rect
                    const r = 4;
                    const [x, y, w, h] = this.dir === 'V' ? [this.x, this.y, this.h, this.w] : [this.x, this.y, this.w, this.h];
                    
                    ctx.beginPath();
                    ctx.moveTo(x + r, y);
                    ctx.arcTo(x + w, y, x + w, y + h, r);
                    ctx.arcTo(x + w, y + h, x, y + h, r);
                    ctx.arcTo(x, y + h, x, y, r);
                    ctx.arcTo(x, y, x + w, y, r);
                    ctx.closePath();
                    ctx.fill();
                    
                    ctx.restore();
                }}
            }}

            function initVehicles() {{
                if (initialized) return;
                const counts = resultData.vehicle_counts || {{}};
                for (const [junction, data] of Object.entries(counts)) {{
                    if (typeof data === 'object') {{
                        for (const [type, count] of Object.entries(data)) {{
                            for (let i = 0; i < count; i++) vehicles.push(new Vehicle(junction, type));
                        }}
                    }}
                }}
                initialized = true;
            }}

            function drawJunction() {{
                // Background
                ctx.fillStyle = '#0B0F19';
                ctx.fillRect(0, 0, W, H);
                
                // Road shadows for depth
                ctx.shadowBlur = 30;
                ctx.shadowColor = 'rgba(0,0,0,0.8)';

                // Main Roads
                ctx.fillStyle = COLORS.road;
                ctx.fillRect(W/2 - ROAD_WIDTH/2, 0, ROAD_WIDTH, H);
                ctx.fillRect(0, H/2 - ROAD_WIDTH/2, W, ROAD_WIDTH);
                
                ctx.shadowBlur = 0;

                // Lane Markings
                ctx.strokeStyle = COLORS.marking;
                ctx.setLineDash([15, 15]);
                ctx.lineWidth = 2;
                
                // Vertical lanes
                ctx.beginPath();
                ctx.moveTo(W/2 - ROAD_WIDTH/2 + 5, 0); ctx.lineTo(W/2 - ROAD_WIDTH/2 + 5, H);
                ctx.moveTo(W/2 + ROAD_WIDTH/2 - 5, 0); ctx.lineTo(W/2 + ROAD_WIDTH/2 - 5, H);
                ctx.stroke();

                // Horizontal lanes
                ctx.beginPath();
                ctx.moveTo(0, H/2 - ROAD_WIDTH/2 + 5); ctx.lineTo(W, H/2 - ROAD_WIDTH/2 + 5);
                ctx.moveTo(0, H/2 + ROAD_WIDTH/2 - 5); ctx.lineTo(W, H/2 + ROAD_WIDTH/2 - 5);
                ctx.stroke();

                // Center Blue Glow Lines
                ctx.setLineDash([]);
                ctx.lineWidth = 3;
                ctx.strokeStyle = COLORS.centerLine;
                ctx.shadowBlur = 10;
                ctx.shadowColor = COLORS.centerLine;
                
                ctx.beginPath();
                ctx.moveTo(W/2, 0); ctx.lineTo(W/2, H/2 - ROAD_WIDTH/2);
                ctx.moveTo(W/2, H/2 + ROAD_WIDTH/2); ctx.lineTo(W/2, H);
                ctx.moveTo(0, H/2); ctx.lineTo(W/2 - ROAD_WIDTH/2, H/2);
                ctx.moveTo(W/2 + ROAD_WIDTH/2, H/2); ctx.lineTo(W, H/2);
                ctx.stroke();
                
                ctx.shadowBlur = 0;

                // Zebra Crossings (Subtle)
                ctx.fillStyle = COLORS.zebra;
                for(let i=0; i<10; i++) {{
                    const gap = ROAD_WIDTH / 10;
                    ctx.fillRect(W/2 - ROAD_WIDTH/2 + i*gap + 2, H/2 - ROAD_WIDTH/2 - 45, gap-4, 35);
                    ctx.fillRect(W/2 - ROAD_WIDTH/2 + i*gap + 2, H/2 + ROAD_WIDTH/2 + 10, gap-4, 35);
                    ctx.fillRect(W/2 + ROAD_WIDTH/2 + 10, H/2 - ROAD_WIDTH/2 + i*gap + 2, 35, gap-4);
                    ctx.fillRect(W/2 - ROAD_WIDTH/2 - 45, H/2 - ROAD_WIDTH/2 + i*gap + 2, 35, gap-4);
                }}

                // Traffic Lights
                const active = resultData.green_junction;
                drawSignal(W/2 + ROAD_WIDTH/2 + 25, H/2 - ROAD_WIDTH/2 - 65, active === 'East', 'East');
                drawSignal(W/2 - ROAD_WIDTH/2 - 45, H/2 - ROAD_WIDTH/2 - 65, active === 'North', 'North');
                drawSignal(W/2 - ROAD_WIDTH/2 - 45, H/2 + ROAD_WIDTH/2 + 25, active === 'West', 'West');
                drawSignal(W/2 + ROAD_WIDTH/2 + 25, H/2 + ROAD_WIDTH/2 + 25, active === 'South', 'South');
            }}

            function drawSignal(x, y, isGreen, label) {{
                // Signal Box
                ctx.fillStyle = COLORS.signalBox;
                ctx.shadowBlur = 10;
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                
                // Rounded box
                const r = 8;
                const w = 24, h = 60;
                ctx.beginPath();
                ctx.moveTo(x + r, y);
                ctx.arcTo(x + w, y, x + w, y + h, r);
                ctx.arcTo(x + w, y + h, x, y + h, r);
                ctx.arcTo(x, y + h, x, y, r);
                ctx.arcTo(x, y, x + w, y, r);
                ctx.closePath();
                ctx.fill();
                ctx.shadowBlur = 0;

                // Red Light
                ctx.fillStyle = !isGreen ? COLORS.red : '#1F2937';
                if (!isGreen) {{
                    ctx.shadowBlur = 15;
                    ctx.shadowColor = COLORS.red;
                }}
                ctx.beginPath(); ctx.arc(x + 12, y + 15, 7, 0, Math.PI * 2); ctx.fill();
                ctx.shadowBlur = 0;

                // Green Light
                ctx.fillStyle = isGreen ? COLORS.green : '#1F2937';
                if (isGreen) {{
                    ctx.shadowBlur = 15;
                    ctx.shadowColor = COLORS.green;
                }}
                ctx.beginPath(); ctx.arc(x + 12, y + 45, 7, 0, Math.PI * 2); ctx.fill();
                ctx.shadowBlur = 0;
            }}

            function animate() {{
                drawJunction();
                initVehicles();
                
                vehicles.forEach((v, index) => {{
                    v.update();
                    v.draw();
                    
                    // Remove vehicles that left the screen
                    if (v.x < -1000 || v.x > W + 1000 || v.y < -1000 || v.y > H + 1000) {{
                        vehicles.splice(index, 1);
                    }}
                }});

                requestAnimationFrame(animate);
            }}
            animate();
        </script>
    </body>
    </html>
    """
    components.html(html_code, height=720, scrolling=False)
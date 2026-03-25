import streamlit.components.v1 as components
import json

def show_simulation(result_data: dict):
    """
    Renders the 3D-style Junction Simulation using the provided HTML/JS.
    Passes the backend results (priority, durations) to the simulation.
    """
    
    html_code = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
            :root {{
                --bg: #0a0c10; --surface: #111520; --panel: #161b27; --border: #1e2535;
                --accent: #00e5ff; --green: #00ff9d; --red: #ff3b5c; --amber: #ffb800;
                --text: #e2e8f5; --muted: #5a6480;
            }}
            body {{ background: var(--bg); color: var(--text); font-family: 'Syne', sans-serif; margin: 0; padding: 0px; }}
            .container {{ max-width: 1400px; margin: 0 auto; display: grid; grid-template-columns: 1fr 300px; gap: 20px; }}
            canvas {{ background: #0d1018; border-radius: 12px; border: 1px solid var(--border); width: 100%; height: auto; }}
            .panel {{ background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }}
            .title {{ color: var(--accent); font-weight: 800; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; font-size: 24px; }}
            .stat-box {{ background: var(--surface); padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid var(--accent); }}
            .stat-label {{ font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; }}
            .stat-value {{ font-family: 'JetBrains Mono', monospace; font-size: 22px; color: var(--accent); margin-top: 5px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="main-view">
                <div class="title">⬡ Junction AI — Live Simulation</div>
                <canvas id="simCanvas" width="1000" height="700"></canvas>
            </div>
            <div class="sidebar">
                <div class="panel">
                    <div class="title">AI Metrics</div>
                    <div class="stat-box">
                        <div class="stat-label">Green Signal Priority</div>
                        <div class="stat-value">{result_data.get('green_junction', 'Calculating...')}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Optimal Duration</div>
                        <div class="stat-value">{result_data.get('green_durations', dict()).get(result_data.get('green_junction'), 0)}s</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Traffic Density</div>
                        <div class="stat-value">{round(sum(result_data.get('weights', dict()).values()), 1) if result_data.get('weights') else 'N/A'}</div>
                    </div>
                </div>
            </div>
        </div>

        <script>
            const canvas = document.getElementById('simCanvas');
            const ctx = canvas.getContext('2d');
            const W = canvas.width, H = canvas.height;
            const resultData = {json.dumps(result_data)};

            function drawJunction() {{
                ctx.fillStyle = '#0a0c10'; // Background
                ctx.fillRect(0, 0, W, H);
                
                const roadWidth = 200; // Much wider roads
                const laneWidth = roadWidth / 2;

                // --- Draw Roads (Black Asphalt) ---
                ctx.fillStyle = '#111';
                ctx.fillRect(W/2 - roadWidth/2, 0, roadWidth, H); // Vertical
                ctx.fillRect(0, H/2 - roadWidth/2, W, roadWidth); // Horizontal

                // --- Draw Lane Markings (White Straps) ---
                ctx.strokeStyle = '#fff';
                ctx.setLineDash([20, 20]);
                ctx.lineWidth = 3;

                // Vertical Lanes
                ctx.beginPath(); ctx.moveTo(W/2 - laneWidth/2, 0); ctx.lineTo(W/2 - laneWidth/2, H); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(W/2 + laneWidth/2, 0); ctx.lineTo(W/2 + laneWidth/2, H); ctx.stroke();
                // Horizontal Lanes
                ctx.beginPath(); ctx.moveTo(0, H/2 - laneWidth/2); ctx.lineTo(W, H/2 - laneWidth/2); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, H/2 + laneWidth/2); ctx.lineTo(W, H/2 + laneWidth/2); ctx.stroke();

                // --- Draw Center Lines (Yellow) ---
                ctx.strokeStyle = '#ffb800';
                ctx.setLineDash([]);
                ctx.lineWidth = 4;
                ctx.beginPath(); ctx.moveTo(W/2, 0); ctx.lineTo(W/2, H); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke();

                // --- Draw Zebra Crossings ---
                ctx.fillStyle = '#fff';
                ctx.setLineDash([]);
                const zebraHeight = 12;
                const stripes = 8;
                const stripeGap = 12;

                // North Zebra
                for(let i=0; i<stripes; i++) ctx.fillRect(W/2 - roadWidth/2 + i*(zebraHeight+stripeGap) + 5, H/2 - roadWidth/2 - 40, zebraHeight, 35);
                // South Zebra
                for(let i=0; i<stripes; i++) ctx.fillRect(W/2 - roadWidth/2 + i*(zebraHeight+stripeGap) + 5, H/2 + roadWidth/2 + 5, zebraHeight, 35);
                // East Zebra
                for(let i=0; i<stripes; i++) ctx.fillRect(W/2 + roadWidth/2 + 5, H/2 - roadWidth/2 + i*(zebraHeight+stripeGap) + 5, 35, zebraHeight);
                // West Zebra
                for(let i=0; i<stripes; i++) ctx.fillRect(W/2 - roadWidth/2 - 40, H/2 - roadWidth/2 + i*(zebraHeight+stripeGap) + 5, 35, zebraHeight);

                // --- Draw Signal Posts ---
                const active = resultData.green_junction;
                
                // Signal positions adjusted for wider roads
                drawSignal(W/2 + roadWidth/2 + 20, H/2 - roadWidth/2 - 60, active === 'East');  // East
                drawSignal(W/2 - roadWidth/2 - 40, H/2 - roadWidth/2 - 60, active === 'North'); // North
                drawSignal(W/2 - roadWidth/2 - 40, H/2 + roadWidth/2 + 20, active === 'West');  // West
                drawSignal(W/2 + roadWidth/2 + 20, H/2 + roadWidth/2 + 20, active === 'South'); // South
            }}

            function drawSignal(x, y, isGreen) {{
                // Signal Box
                ctx.fillStyle = '#222';
                ctx.fillRect(x, y, 20, 50);
                
                // Red Light
                ctx.fillStyle = isGreen ? '#333' : '#ff3b5c';
                ctx.beginPath(); ctx.arc(x + 10, y + 10, 6, 0, Math.PI * 2); ctx.fill();
                if (!isGreen) {{ ctx.shadowBlur = 15; ctx.shadowColor = '#ff3b5c'; ctx.stroke(); ctx.shadowBlur = 0; }}
                
                // Yellow Light (Always off in this logic)
                ctx.fillStyle = '#333';
                ctx.beginPath(); ctx.arc(x + 10, y + 25, 6, 0, Math.PI * 2); ctx.fill();
                
                // Green Light
                ctx.fillStyle = isGreen ? '#00ff9d' : '#333';
                ctx.beginPath(); ctx.arc(x + 10, y + 40, 6, 0, Math.PI * 2); ctx.fill();
                if (isGreen) {{ ctx.shadowBlur = 15; ctx.shadowColor = '#00ff9d'; ctx.stroke(); ctx.shadowBlur = 0; }}
            }}

            function animate() {{
                drawJunction();
                requestAnimationFrame(animate);
            }}
            animate();
        </script>
    </body>
    </html>
    """
    components.html(html_code, height=700, scrolling=False)
    
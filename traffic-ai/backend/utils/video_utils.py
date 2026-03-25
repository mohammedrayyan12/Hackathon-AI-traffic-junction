"""
Video Frame Extraction Utility
Extracts evenly-spaced frames from a video file for YOLO analysis.
"""
import cv2
import tempfile
from typing import List


def extract_frames(video_path: str, max_frames: int = 5) -> List[str]:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    indices = _even_indices(total_frames, max_frames)
    saved_paths = []

    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ret, frame = cap.read()
        if not ret:
            continue
        tmp = tempfile.NamedTemporaryFile(suffix='.jpg', delete=False)
        cv2.imwrite(tmp.name, frame)
        saved_paths.append(tmp.name)

    cap.release()
    return saved_paths


def _even_indices(total: int, n: int) -> List[int]:
    if total <= 0 or n <= 0:
        return []
    step = max(1, total // n)
    return [i * step for i in range(min(n, total))]

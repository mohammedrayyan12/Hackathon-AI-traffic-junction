"""
YOLO Vehicle Detection Module
Uses YOLOv8 (ultralytics) to count vehicles in images or video frames.
Vehicle classes in COCO dataset: car=2, motorcycle=3, bus=5, truck=7
"""

try:
    from ultralytics import YOLO
    from ultralytics.nn.tasks import DetectionModel
    from ultralytics.nn.modules.conv import Conv, Concat
    from ultralytics.nn.modules.block import C2f, Bottleneck, SPPF, DFL
    from ultralytics.nn.modules.head import Detect
    import torch
    from torch.nn.modules.container import Sequential, ModuleList
    from torch.nn.modules.conv import Conv2d
    from torch.nn.modules.batchnorm import BatchNorm2d
    from torch.nn.modules.activation import SiLU
    from torch.nn.modules.pooling import MaxPool2d
    from torch.nn.modules.upsampling import Upsample

    # Add required classes to the safe globals for torch.load to address the
    # pickle error in newer PyTorch versions.
    torch.serialization.add_safe_globals([
        DetectionModel, Sequential, Conv, Conv2d, BatchNorm2d, SiLU, C2f, 
        ModuleList, Bottleneck, SPPF, MaxPool2d, Upsample, Concat, Detect, DFL
    ])

    _model = YOLO('yolov8n.pt')
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False

VEHICLE_CLASS_IDS = {2, 3, 5, 7}  # car, motorcycle, bus, truck


def detect_vehicles(image_path: str) -> int:
    """
    Run YOLO inference on a single image path.
    Returns integer count of detected vehicles.
    """
    if not YOLO_AVAILABLE:
        return _mock_detect(image_path)

    results = _model(image_path, verbose=False)
    count = 0
    for result in results:
        for cls_id in result.boxes.cls.tolist():
            if int(cls_id) in VEHICLE_CLASS_IDS:
                count += 1
    return count


def _mock_detect(image_path) -> int:
    """Mock detection when YOLO not installed (for testing UI)."""
    import hashlib
    seed = int(hashlib.md5(str(image_path).encode()).hexdigest()[:8], 16)
    return (seed % 25) + 1

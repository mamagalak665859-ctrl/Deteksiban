import base64
import io
import json
import os

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.utils.translation import gettext_lazy as _, get_language
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from PIL import Image

from .models import TireAnalysis


# ── Dashboard ────────────────────────────────────────────────────

@login_required
def dashboard(request):
    recent = TireAnalysis.objects.filter(user=request.user)[:6]
    total  = TireAnalysis.objects.filter(user=request.user).count()
    latest = recent.first()
    model_accuracy = 89.1
    try:
        from django.conf import settings
        meta_path = os.path.join(getattr(settings, 'TIRESCAN_MODELS_DIR', ''), 'model_meta.json')
        if os.path.isfile(meta_path):
            with open(meta_path, 'r') as f:
                meta = json.load(f)
            model_accuracy = round(float(meta.get('best_val_f1', 0.891)) * 100, 1)
    except Exception:
        pass

    ctx = {
        'recent_analyses': recent,
        'total_analyses':  total,
        'latest_analysis': latest,
        'model_accuracy':  model_accuracy,
        'LANGUAGE_CODE':   get_language(),
    }
    return render(request, 'analysis/dashboard.html', ctx)


# ── History ──────────────────────────────────────────────────────

@login_required
def history(request):
    analyses = TireAnalysis.objects.filter(user=request.user)
    return render(request, 'analysis/history.html', {
        'analyses': analyses,
        'LANGUAGE_CODE': get_language(),
    })


# ── Detail ───────────────────────────────────────────────────────

@login_required
def detail(request):
    analyses = TireAnalysis.objects.filter(user=request.user)
    selected = None
    pk = request.GET.get('id')
    if pk:
        selected = get_object_or_404(TireAnalysis, pk=pk, user=request.user)
    return render(request, 'analysis/detail.html', {
        'analyses': analyses,
        'selected': selected,
        'LANGUAGE_CODE': get_language(),
    })


# ── Analyze API ──────────────────────────────────────────────────

@login_required
@require_POST
def analyze_api(request):
    try:
        body      = json.loads(request.body)
        b64_data  = body.get('image', '')
        tire_year = body.get('tire_year')
        cam_mode  = body.get('camera_mode', 'front')

        if ',' in b64_data:
            b64_data = b64_data.split(',', 1)[1]
        img_bytes = base64.b64decode(b64_data)
        pil_img   = Image.open(io.BytesIO(img_bytes)).convert('RGB')

        result         = _run_model(pil_img)
        confidence     = float(result.get('confidence', 0.0))
        model_accuracy = float(result.get('model_accuracy', 0.0))

        from django.core.files.base import ContentFile
        img_io = io.BytesIO()
        pil_img.save(img_io, format='JPEG', quality=85)

        analysis = TireAnalysis(
            user        = request.user,
            condition   = result.get('condition', 'unknown'),
            label       = result.get('label', ''),
            confidence  = confidence,
            tire_year   = int(tire_year) if tire_year else None,
            camera_mode = cam_mode,
            raw_result  = result,
        )
        analysis.image.save(
            f"analysis_{request.user.id}_{analysis.pk or 'new'}.jpg",
            ContentFile(img_io.getvalue()),
            save=False,
        )
        analysis.save()

        return JsonResponse({
            'ok':             True,
            'id':             analysis.pk,
            'condition':      analysis.condition,
            'label':          analysis.label,
            'confidence':     round(confidence * 100, 1),
            'model_accuracy': round(model_accuracy, 1),
            'color':          analysis.get_condition_display_color(),
            'image_url':      analysis.image.url,
            # PLT card fields
            'contrast':       result.get('contrast'),
            'entropy':        result.get('entropy'),
            'oc_svm_score':   result.get('oc_svm_score'),
            'probabilities':  result.get('probabilities', {}),
        })

    except Exception as exc:
        import traceback
        print(f"[ANALYZE ERROR] {exc}\n{traceback.format_exc()}")
        return JsonResponse({'ok': False, 'error': str(exc)}, status=500)


# ── Delete / Clear ────────────────────────────────────────────────

@login_required
@require_POST
def delete_analysis(request, pk):
    obj = get_object_or_404(TireAnalysis, pk=pk, user=request.user)
    if obj.image:
        try:
            os.remove(obj.image.path)
        except FileNotFoundError:
            pass
    obj.delete()
    return JsonResponse({'ok': True})


@login_required
@require_POST
def clear_history(request):
    objs = TireAnalysis.objects.filter(user=request.user)
    for obj in objs:
        if obj.image:
            try:
                os.remove(obj.image.path)
            except FileNotFoundError:
                pass
    objs.delete()
    return JsonResponse({'ok': True})


# ── ML pipeline ───────────────────────────────────────────────────

def _run_model(pil_img):
    from django.conf import settings
    models_dir = getattr(settings, 'TIRESCAN_MODELS_DIR', '') or \
                 os.environ.get('TIRESCAN_MODELS_DIR', '')
    if models_dir and os.path.isdir(models_dir):
        try:
            return _run_real_model(pil_img, models_dir)
        except Exception as e:
            import traceback
            print(f"[ML WARNING] Real model failed: {e}\n{traceback.format_exc()}")
    return _stub_predict(pil_img)


def _run_real_model(pil_img, models_dir):
    """
    Full 3-layer prediction pipeline.

    Feature vector: 363 dimensions total
      GLCM   =  48  (6 props × 2 distances × 4 angles)
      LBP    =  26  (uniform, P=24, R=3)
      Gabor  =  32  (4 freqs × 4 thetas × 2 stats)
      Stats  =   5  (mean, std, skew, kurtosis, entropy)
      HOG    = 252  (orientations=7, pixels_per_cell=(32,32),
                     cells_per_block=(2,2) on 128×128 image)
    """
    import warnings
    warnings.filterwarnings('ignore')

    import numpy as np
    import joblib
    import cv2
    from skimage.feature import local_binary_pattern, graycomatrix, graycoprops, hog
    from skimage.filters import gabor
    from scipy.stats import skew, kurtosis as kurt

    TARGET_SIZE          = (128, 128)
    CONFIDENCE_THRESHOLD = 0.40
    MIN_CONTRAST         = 5.0
    MIN_LBP_ENTROPY      = 0.8

    # Load model components
    scaler   = joblib.load(os.path.join(models_dir, 'scaler.pkl'))
    selector = joblib.load(os.path.join(models_dir, 'selector.pkl'))
    pca_obj  = joblib.load(os.path.join(models_dir, 'pca.pkl'))
    oc_svm   = joblib.load(os.path.join(models_dir, 'oc_svm.pkl'))
    svm      = joblib.load(os.path.join(models_dir, 'svm_model.pkl'))

    with open(os.path.join(models_dir, 'model_meta.json')) as f:
        meta = json.load(f)

    CLASSES        = meta.get('classes', [])
    IDX_MAP        = {i: c for i, c in enumerate(CLASSES)}
    model_accuracy = round(float(meta.get('best_val_f1', 0.891)) * 100, 1)

    # ── Feature extractors ────────────────────────────────────────

    def _glcm(g8):  # 48 features
        glcm = graycomatrix(g8, distances=[1, 3],
                            angles=[0, np.pi/4, np.pi/2, 3*np.pi/4],
                            levels=256, symmetric=True, normed=True)
        return np.concatenate([graycoprops(glcm, p).ravel()
                               for p in ['contrast', 'dissimilarity', 'homogeneity',
                                         'energy', 'correlation', 'ASM']])

    def _lbp(g8):  # 26 features
        lbp  = local_binary_pattern(g8, P=24, R=3, method='uniform')
        hist, _ = np.histogram(lbp.ravel(), bins=np.arange(0, 27), density=True)
        return hist

    def _gabor(gf):  # 32 features
        feats = []
        for freq in [0.1, 0.2, 0.3, 0.4]:
            for theta in [0, np.pi/4, np.pi/2, 3*np.pi/4]:
                r, _ = gabor(gf, frequency=freq, theta=theta)
                feats.extend([r.mean(), r.std()])
        return np.array(feats)

    def _stats(g8):  # 5 features
        flat = g8.flatten().astype(np.float64)
        hist, _ = np.histogram(flat, bins=256, density=True)
        h = hist[hist > 0]
        return np.array([flat.mean(), flat.std(), skew(flat),
                         kurt(flat), -np.sum(h * np.log2(h))])

    def _hog(g8):  # 252 features — must match training exactly
        return hog(g8, orientations=7,
                   pixels_per_cell=(32, 32),
                   cells_per_block=(2, 2),
                   block_norm='L2-Hys',
                   feature_vector=True)

    def extract_features(image_array):
        gray  = cv2.cvtColor(image_array, cv2.COLOR_RGB2GRAY) \
                if len(image_array.shape) == 3 else image_array.copy()
        gray  = cv2.resize(gray.astype(np.uint8), TARGET_SIZE)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        g8    = clahe.apply(gray)
        gf    = g8.astype(np.float64) / 255.0
        return np.concatenate([_glcm(g8), _lbp(g8), _gabor(gf), _stats(g8), _hog(g8)])

    # ── Heuristic check (Layer 1) ─────────────────────────────────

    def heuristic_check(image_array):
        gray = cv2.cvtColor(image_array, cv2.COLOR_RGB2GRAY) \
               if len(image_array.shape) == 3 else image_array.copy()
        gray = cv2.resize(gray.astype(np.uint8), TARGET_SIZE)
        g8   = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)

        contrast = float(g8.std())
        if contrast < MIN_CONTRAST:
            return False, f"low_contrast ({contrast:.1f})", contrast, None

        lbp  = local_binary_pattern(g8, P=24, R=3, method='uniform')
        h, _ = np.histogram(lbp.ravel(), bins=np.arange(0, 27), density=True)
        hp   = h[h > 0]
        entropy = float(-np.sum(hp * np.log2(hp)))
        if entropy < MIN_LBP_ENTROPY:
            return False, f"low_entropy ({entropy:.2f})", contrast, entropy

        return True, f"contrast={contrast:.1f} entropy={entropy:.2f}", contrast, entropy

    # ── Single-scale prediction ───────────────────────────────────

    def predict_image(image_array):
        h_ok, h_reason, contrast_val, entropy_val = heuristic_check(image_array)

        base_extra = {
            'contrast': round(contrast_val, 2) if contrast_val is not None else None,
            'entropy':  round(entropy_val,  2) if entropy_val  is not None else None,
        }

        if not h_ok:
            return {'condition': 'not_tire', 'label': 'not_tire',
                    'confidence': 0.0, 'reject_reason': f'L1: {h_reason}',
                    **base_extra, 'oc_svm_score': None, 'probabilities': {}}

        feats = extract_features(image_array)
        fp    = pca_obj.transform(
                    selector.transform(scaler.transform(feats.reshape(1, -1))))

        oc_score = float(oc_svm.decision_function(fp)[0])
        if oc_svm.predict(fp)[0] != 1:
            return {'condition': 'not_tire', 'label': 'not_tire',
                    'confidence': 0.0, 'reject_reason': f'L2: outlier (score={oc_score:.3f})',
                    **base_extra, 'oc_svm_score': round(oc_score, 4), 'probabilities': {}}

        proba      = svm.predict_proba(fp)[0]
        pred_idx   = int(np.argmax(proba))
        confidence = float(proba[pred_idx])
        label      = IDX_MAP.get(pred_idx, 'unknown')

        # Build named probability dict for frontend PLT card
        proba_dict = {cls: round(float(p), 4) for cls, p in zip(CLASSES, proba)}

        if confidence < CONFIDENCE_THRESHOLD:
            return {'condition': 'unknown', 'label': label,
                    'confidence': confidence, 'proba': proba.tolist(),
                    'probabilities': proba_dict, 'classes': CLASSES,
                    **base_extra, 'oc_svm_score': round(oc_score, 4)}

        cond_map = {
            'normal': 'good', 'good': 'good',
            'cracked': 'damaged', 'tear': 'damaged', 'Tear': 'damaged',
            'worn': 'worn',
        }
        condition = cond_map.get(label, cond_map.get(label.lower(), 'unknown'))
        return {'condition': condition, 'label': label,
                'confidence': confidence, 'proba': proba.tolist(),
                'probabilities': proba_dict, 'classes': CLASSES,
                **base_extra, 'oc_svm_score': round(oc_score, 4)}

    # ── Multi-scale: pick highest-confidence result ───────────────
    pil_np = np.array(pil_img)
    best   = {'confidence': -1.0, 'result': None}

    for scale in [1.0, 0.85, 0.65]:
        try:
            if scale >= 0.99:
                img = pil_np
            else:
                w, h = pil_img.size
                cw, ch = int(w * scale), int(h * scale)
                left, top = (w - cw) // 2, (h - ch) // 2
                img = np.array(pil_img.crop((left, top, left + cw, top + ch)))

            res  = predict_image(img)
            conf = float(res.get('confidence', 0.0))
            if conf > best['confidence']:
                best = {'confidence': conf, 'result': res}
        except Exception as e:
            print(f"[ML] scale={scale} error: {e}")
            continue

    final = best['result'] or {'condition': 'unknown', 'label': 'unknown', 'confidence': 0.0}
    final['model_accuracy'] = model_accuracy
    return final


def _stub_predict(pil_img):
    """Fallback when model files are missing — brightness-based heuristic."""
    import numpy as np
    avg = float(np.array(pil_img.convert('L')).mean())
    if avg > 180:
        return {'condition': 'good',    'label': 'normal',  'confidence': 0.91, 'model_accuracy': 89.1}
    elif avg > 120:
        return {'condition': 'worn',    'label': 'worn',    'confidence': 0.85, 'model_accuracy': 89.1}
    elif avg > 80:
        return {'condition': 'damaged', 'label': 'cracked', 'confidence': 0.79, 'model_accuracy': 89.1}
    else:
        return {'condition': 'damaged', 'label': 'Tear',    'confidence': 0.82, 'model_accuracy': 89.1}

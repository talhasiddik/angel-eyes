"""
Direct H5 file manipulation to fix batch_shape issue
This edits the model config in the H5 file to replace batch_shape with shape
"""
import h5py
import json
import os
import shutil

def fix_h5_model(input_path, output_path):
    """Fix batch_shape in H5 model file"""
    print(f"\n{'='*70}")
    print(f"Processing: {os.path.basename(input_path)}")
    print(f"{'='*70}")
    
    # Create backup
    backup_path = input_path + '.backup'
    if not os.path.exists(backup_path):
        shutil.copy2(input_path, backup_path)
        print(f"✅ Backup created: {backup_path}")
    
    try:
        # Open H5 file
        with h5py.File(input_path, 'r+') as f:
            # Get model config
            if 'model_config' not in f.attrs:
                print("❌ No model_config found in file")
                return False
            
            config_str = f.attrs['model_config']
            if isinstance(config_str, bytes):
                config_str = config_str.decode('utf-8')
            
            config = json.loads(config_str)
            
            # Fix batch_shape in all layers
            fixed_count = 0
            
            def fix_layer_config(layer_config):
                nonlocal fixed_count
                if isinstance(layer_config, dict):
                    # Check if this layer has batch_shape
                    if 'config' in layer_config and 'batch_shape' in layer_config['config']:
                        batch_shape = layer_config['config']['batch_shape']
                        # Extract shape (remove None/batch dimension)
                        if batch_shape and len(batch_shape) > 1:
                            shape = batch_shape[1:]  # Remove first element (None)
                            layer_config['config']['shape'] = shape
                            layer_config['config']['batch_size'] = None
                            del layer_config['config']['batch_shape']
                            fixed_count += 1
                            print(f"  ✅ Fixed layer: {layer_config.get('name', 'unknown')}")
                            print(f"     batch_shape={batch_shape} → shape={shape}")
                    
                    # Recursively check nested structures
                    for key, value in layer_config.items():
                        if isinstance(value, (dict, list)):
                            fix_layer_config(value)
                elif isinstance(layer_config, list):
                    for item in layer_config:
                        fix_layer_config(item)
            
            # Fix the config
            fix_layer_config(config)
            
            if fixed_count > 0:
                # Save modified config
                new_config_str = json.dumps(config)
                del f.attrs['model_config']
                f.attrs['model_config'] = new_config_str
                
                print(f"\n✅ Fixed {fixed_count} layer(s)")
                print(f"✅ Saved to: {output_path}")
                return True
            else:
                print("ℹ️  No batch_shape parameters found")
                return False
                
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

# Paths
base_dir = r"D:\FAST\8th-Semester\FYP\Development\backend\ai-service\updatedModels"

models_to_fix = [
    {
        'name': 'Eye Detector',
        'input': os.path.join(base_dir, 'eye_detector_best.h5'),
        'output': os.path.join(base_dir, 'eye_detector_best.h5')  # Overwrite
    },
    {
        'name': 'Cry Detector',
        'input': os.path.join(base_dir, 'stage1_cry_detection_model1.h5'),
        'output': os.path.join(base_dir, 'stage1_cry_detection_model1.h5')  # Overwrite
    }
]

print("="*70)
print("H5 MODEL FIXER - Direct batch_shape Removal")
print("="*70)
print("\nThis will modify the H5 files directly.")
print("Backups will be created with .backup extension.")
print()

results = []
for model_info in models_to_fix:
    success = fix_h5_model(model_info['input'], model_info['output'])
    results.append((model_info['name'], success))

# Summary
print("\n" + "="*70)
print("FIX SUMMARY")
print("="*70)
for name, success in results:
    status = "✅ SUCCESS" if success else "❌ FAILED"
    print(f"{status}: {name}")

if all(success for _, success in results):
    print("\n🎉 All models fixed successfully!")
    print("\nNext: Test the models with test_models.py")
else:
    print("\n⚠️  Some fixes failed. Check errors above.")

print("\nℹ️  Original files backed up with .backup extension")

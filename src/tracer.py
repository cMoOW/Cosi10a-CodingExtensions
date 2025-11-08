import sys
import json
import io
import os

redirected_stdout = io.StringIO()
execution_trace = []
main_filename = None # Will store the *absolute, normalized* path

class MockStdin:
    def readline(self):
        return "\n"

def safe_serialize(obj):
    """
    A faster, safer serializer.
    It only serializes basic, JSON-safe types.
    """
    safe_vars = {}
    if not isinstance(obj, dict):
        return {}

    for key, value in obj.items():
        # Ignore modules, callables, and private vars
        if key.startswith('__') or callable(value) or 'module' in str(type(value)):
            continue
        
        # --- OPTIMIZATION ---
        # Only capture simple, serializable types
        if isinstance(value, (int, float, str, bool, list, dict, set, tuple, type(None))):
            try:
                # repr() is often safer/faster for simple types
                safe_vars[key] = repr(value)
            except Exception:
                safe_vars[key] = "[Unserializable]"
        else:
            # For complex objects, just show the type
            safe_vars[key] = f"<type {type(value).__name__}>"
        # --------------------
            
    return safe_vars


def tracer(frame, event, arg):
    """
    The main tracer function, now optimized.
    It only checks the filename on 'call' events.
    """
    global redirected_stdout
    global main_filename

    # --- OPTIMIZATION ---
    # We only check the filename when we ENTER a new function/module
    if event == 'call':
        try:
            frame_filename = os.path.normcase(os.path.abspath(frame.f_code.co_filename))
        except Exception:
            return None # Not a file, don't trace
        
        if frame_filename != main_filename:
            return None # Not our code, don't trace
        
        # It IS our code, so trace this frame.
        return tracer 
    
    # We are only here if it's a 'line' (or other) event
    # in a frame we've already approved.
    if event == 'line':
    # --------------------
        output = redirected_stdout.getvalue()
        redirected_stdout.seek(0)
        redirected_stdout.truncate(0)

        code = frame.f_code
        func_name = code.co_name
        line_no = frame.f_lineno
        local_vars = safe_serialize(frame.f_locals)
        
        snapshot = {
            'event': event,
            'func_name': func_name,
            'line_no': line_no,
            'local_vars': local_vars,
            'output': output
        }
        execution_trace.append(snapshot)
    
    return tracer

# --- Main script execution (Unchanged, but uses new tracer) ---
if __name__ == "__main__":
    #global main_filename

    if len(sys.argv) < 2:
        print("Error: No script file provided.", file=sys.stderr)
        sys.exit(1)
        
    script_to_run = sys.argv[1]
    
    original_stdout = sys.stdout
    sys.stdout = redirected_stdout
    original_stdin = sys.stdin
    
    if len(sys.argv) > 2 and sys.argv[2]:
        input_data = sys.argv[2].replace("\\n", "\n")
        sys.stdin = io.StringIO(input_data)
    else:
        sys.stdin = MockStdin()
    
    try:
        with open(script_to_run, 'r') as f:
            script_content = f.read()

        main_code_object = compile(script_content, script_to_run, 'exec')
        
        # Store the normalized, absolute path of the script.
        main_filename = os.path.normcase(os.path.abspath(main_code_object.co_filename))
        
        sys.settrace(tracer)
        scope = {}
        exec(main_code_object, scope, scope)

    except Exception as e:
        sys.stdout = original_stdout 
        sys.stdin = original_stdin 
        print(f"Error during script execution: {e}", file=sys.stderr)
        sys.exit(1)
        
    finally:
        sys.settrace(None)
        sys.stdout = original_stdout
        sys.stdin = original_stdin 
        
        final_output = redirected_stdout.getvalue()
        if final_output and execution_trace:
            execution_trace[-1]['output'] += final_output

    print(json.dumps(execution_trace, indent=2))
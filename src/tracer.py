import sys
import json
import io
import os # <-- NEW: Import the 'os' module

redirected_stdout = io.StringIO()
execution_trace = []
main_filename = None # We'll store the *absolute* path here

# --- MockStdin class (unchanged) ---
class MockStdin:
    def readline(self):
        return "\n"

# --- safe_serialize function (unchanged) ---
def safe_serialize(obj):
    safe_vars = {}
    if not isinstance(obj, dict):
        return {}
    for key, value in obj.items():
        if key.startswith('__') or callable(value) or 'module' in str(type(value)):
            continue
        try:
            safe_vars[key] = str(value)
        except Exception:
            safe_vars[key] = "[Unserializable]"
    return safe_vars

# --- tracer function (THIS IS THE FIX) ---
def tracer(frame, event, arg):
    global redirected_stdout
    global main_filename 

    # --- THE FIX ---
    # We now get the *absolute* path of the current frame's file
    # and compare it to the *absolute* path of our main script.
    try:
        frame_filename = os.path.abspath(frame.f_code.co_filename)
    except Exception:
        # Handle edge cases where a filename is not available (e.g., <string>)
        return None

    if frame_filename != main_filename:
        # Not in our file, so stop tracing this frame (e.g., an import)
        return None
    # ---------------

    if event == 'line':
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

# --- Main script execution (THIS IS THE OTHER PART OF THE FIX) ---
if __name__ == "__main__":
    #global main_filename

    if len(sys.argv) < 2:
        print("Error: No script file provided.", file=sys.stderr)
        sys.exit(1)
        
    script_to_run = sys.argv[1]
    
    # ... (stdout/stdin redirection is unchanged) ...
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
        
        # --- THE FIX ---
        # Store the normalized, *absolute* path of the script.
        main_filename = os.path.abspath(main_code_object.co_filename)
        # ---------------
        
        sys.settrace(tracer)
        scope = {}
        exec(main_code_object, scope, scope)

    except Exception as e:
        sys.stdout = original_stdout 
        sys.stdin = original_stdin 
        print(f"Error during script execution: {e}", file=sys.stderr)
        sys.exit(1)
        
    finally:
        # ... (rest of finally block is unchanged) ...
        sys.settrace(None)
        sys.stdout = original_stdout
        sys.stdin = original_stdin 
        final_output = redirected_stdout.getvalue()
        if final_output and execution_trace:
            execution_trace[-1]['output'] += final_output

    print(json.dumps(execution_trace, indent=2))
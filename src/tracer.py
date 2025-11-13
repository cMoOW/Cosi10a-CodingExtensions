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

if __name__ == "__main__":
    #global main_filename

    # --- NEW: Define exit codes ---
    EXIT_CODE_SUCCESS = 0
    EXIT_CODE_RUNTIME_ERROR = 1
    EXIT_CODE_SYNTAX_ERROR = 2
    # -----------------------------

    if len(sys.argv) < 3:
        print("Error: Missing args.", file=sys.stderr)
        sys.exit(EXIT_CODE_RUNTIME_ERROR) 
    
    input_data_str = sys.argv[1]
    script_to_run = sys.argv[2] 
    script_content = sys.stdin.read()

    # --- Setup stdout/stdin redirection ---
    original_stdout = sys.stdout
    sys.stdout = redirected_stdout
    original_stdin = sys.stdin
    
    if input_data_str:
        input_data = input_data_str.replace("\\n", "\n")
        sys.stdin = io.StringIO(input_data)
    else:
        sys.stdin = MockStdin()
    
    scope = {}
    
    # We must restore stdio *after* the run, so we need one big try/finally
    try:
        try:
            # --- 1. Try to compile ---
            main_code_object = compile(script_content, script_to_run, 'exec')
        except (SyntaxError, IndentationError, TabError) as e:
            # --- Compile-time error ---
            # Print error so VS Code can see it, but exit with a special code
            print(f"Syntax Error: {e}", file=sys.stderr)
            sys.exit(EXIT_CODE_SYNTAX_ERROR)
            
        # --- 2. Try to execute ---
        main_filename = os.path.normcase(os.path.abspath(main_code_object.co_filename))
        sys.settrace(tracer)
        exec(main_code_object, scope, scope)
        
    except Exception as e:
        # --- Runtime error (e.g., NameError) ---
        sys.stdout = original_stdout 
        sys.stdin = original_stdin 
        print(f"Error during script execution: {e}", file=sys.stderr)
        sys.exit(EXIT_CODE_RUNTIME_ERROR)
        
    finally:
        # --- 3. Cleanup (always runs) ---
        sys.settrace(None)
        # Restore original stdio
        sys.stdout = original_stdout
        sys.stdin = original_stdin 
    
    # --- 4. Success Case ---
    # We only get here if no exceptions were raised.
    final_output = redirected_stdout.getvalue()
    if execution_trace:
        final_vars = safe_serialize(scope)
        execution_trace[-1]['output'] += final_output
        execution_trace[-1]['local_vars'] = final_vars
        
    print(json.dumps(execution_trace, indent=2))
    sys.exit(EXIT_CODE_SUCCESS) # Explicit success exit
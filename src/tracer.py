import sys
import json
import io
import os

redirected_stdout = io.StringIO()
execution_trace = []
main_filename = None

class MockStdin:
    """A fake stdin that simulates a user pressing 'Enter'."""
    def readline(self):
        return "\n"

def safe_serialize(obj):
    """
    A robust serializer that iterates over a dictionary,
    skipping known unserializable types.
    """
    safe_vars = {}
    if not isinstance(obj, dict):
        return {}

    # Iterate over a copy to avoid mutation errors
    for key, value in obj.copy().items():
        # Skip private vars, modules, and callables
        if key.startswith('__') or callable(value) or 'module' in str(type(value)):
            continue
        
        try:
            # repr() is the safest way to get a string
            safe_vars[key] = repr(value)
        except Exception:
            # Catch errors on complex objects that fail repr()
            safe_vars[key] = f"<Unserializable type {type(value).__name__}>"
    
    return safe_vars


def tracer(frame, event, arg):
    """
    The main tracer function.
    """
    global redirected_stdout
    global main_filename

    # 1. Handle 'call' event to step into functions
    if event == 'call':
        try:
            frame_filename = os.path.normcase(os.path.abspath(frame.f_code.co_filename))
        except Exception:
            return None 
        
        if frame_filename != main_filename:
            return None # Not our code
        
        return tracer 
    
    # 2. Handle 'line' or 'return' events
    if event == 'line' or event == 'return':
        output = redirected_stdout.getvalue()
        redirected_stdout.seek(0)
        redirected_stdout.truncate(0)

        code = frame.f_code
        func_name = code.co_name
        line_no = frame.f_lineno
        
        # --- THIS IS THE CHANGE ---
        
        # 3. Clean and serialize f_locals
        locals_copy = frame.f_locals.copy()
        locals_copy.pop('frame', None)
        locals_copy.pop('event', None)
        locals_copy.pop('arg', None)
        local_vars = safe_serialize(locals_copy)
        
        # 4. Serialize f_globals
        global_vars = safe_serialize(frame.f_globals)
        
        # 5. Add *both* to the snapshot
        snapshot = {
            'event': event,
            'func_name': func_name,
            'line_no': line_no,
            'local_vars': local_vars,
            'global_vars': global_vars, # <-- NEW
            'output': output
        }
        # --- END OF CHANGE ---
        
        execution_trace.append(snapshot)
    
    return tracer

# --- Main script execution ---
if __name__ == "__main__":
    #global main_filename

    EXIT_CODE_SUCCESS = 0
    EXIT_CODE_RUNTIME_ERROR = 1
    EXIT_CODE_SYNTAX_ERROR = 2

    if len(sys.argv) < 3:
        print("Error: Missing args.", file=sys.stderr)
        sys.exit(EXIT_CODE_RUNTIME_ERROR) 
    
    input_data_str = sys.argv[1]
    script_to_run = sys.argv[2] 
    script_content = sys.stdin.read()
    
    original_stdout = sys.stdout
    sys.stdout = redirected_stdout
    original_stdin = sys.stdin
    
    if input_data_str:
        input_data = input_data_str.replace("\\n", "\n")
        sys.stdin = io.StringIO(input_data)
    else:
        sys.stdin = MockStdin()
    
    scope = {}
    
    try:
        try:
            main_code_object = compile(script_content, script_to_run, 'exec')
        except (SyntaxError, IndentationError, TabError) as e:
            print(f"Syntax Error: {e}", file=sys.stderr)
            sys.exit(EXIT_CODE_SYNTAX_ERROR)
            
        main_filename = os.path.normcase(os.path.abspath(main_code_object.co_filename))
        sys.settrace(tracer)
        exec(main_code_object, scope, scope)
        
    except Exception as e:
        sys.stdout = original_stdout 
        sys.stdin = original_stdin 
        print(f"Error during script execution: {e}", file=sys.stderr)
        sys.exit(EXIT_CODE_RUNTIME_ERROR)
        
    finally:
        sys.settrace(None)
        sys.stdout = original_stdout
        sys.stdin = original_stdin 
    
    # --- Success Case ---
    final_output = redirected_stdout.getvalue()
    if execution_trace:
        execution_trace[-1]['output'] += final_output
        
        final_global_vars = safe_serialize(scope)
        
        # --- THIS IS THE CHANGE ---
        # Set the *final* global state on the last step
        execution_trace[-1]['global_vars'] = final_global_vars
        
        # Only set local vars if the last step was *in* the global scope
        if execution_trace[-1]['func_name'] == '<module>':
            execution_trace[-1]['local_vars'] = final_global_vars
        # --- END OF CHANGE ---
        
    print(json.dumps(execution_trace, indent=2))
    sys.exit(EXIT_CODE_SUCCESS)
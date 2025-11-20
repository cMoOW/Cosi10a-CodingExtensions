import sys
import json
import io
import os
import random 

redirected_stdout = io.StringIO()
execution_trace = []
main_filename = None

class EchoingStringIO:
    def __init__(self, input_str):
        self._buffer = io.StringIO(input_str)
        self._eof_return = "\n" 

    def readline(self):
        line = self._buffer.readline()
        if not line:
            return self._eof_return 
        sys.stdout.write(line)
        return line

class MockStdin:
    """A fake stdin that simulates a user pressing 'Enter'."""
    def readline(self):
        return "\n"

def safe_serialize(obj):
    safe_vars = {}
    if not isinstance(obj, dict):
        return {}

    for key, value in obj.copy().items():
        if key.startswith('__') or callable(value) or 'module' in str(type(value)):
            continue
        
        try:
            safe_vars[key] = repr(value)
        except Exception:
            safe_vars[key] = f"<Unserializable type {type(value).__name__}>"
    
    return safe_vars

def tracer(frame, event, arg):
    global redirected_stdout
    global main_filename

    if event == 'call':
        try:
            frame_filename = os.path.normcase(os.path.abspath(frame.f_code.co_filename))
        except Exception:
            return None 
        
        if frame_filename != main_filename:
            return None 
        
        return tracer 
    
    if event == 'line' or event == 'return':
        output = redirected_stdout.getvalue()
        redirected_stdout.seek(0)
        redirected_stdout.truncate(0)

        code = frame.f_code
        func_name = code.co_name
        line_no = frame.f_lineno
        
        locals_copy = frame.f_locals.copy()
        locals_copy.pop('frame', None)
        locals_copy.pop('event', None)
        locals_copy.pop('arg', None)
        local_vars = safe_serialize(locals_copy)
        
        global_vars = safe_serialize(frame.f_globals)
        
        snapshot = {
            'event': event,
            'func_name': func_name,
            'line_no': line_no,
            'local_vars': local_vars,
            'global_vars': global_vars,
            'output': output
        }
        execution_trace.append(snapshot)
    
    return tracer

# --- Main script execution ---
if __name__ == "__main__":
   # global main_filename

    EXIT_CODE_SUCCESS = 0
    EXIT_CODE_RUNTIME_ERROR = 1
    EXIT_CODE_SYNTAX_ERROR = 2

    # We will store the exit code here and exit at the very end
    final_exit_code = EXIT_CODE_SUCCESS

    if len(sys.argv) < 3:
        print("Error: Missing args.", file=sys.stderr)
        sys.exit(EXIT_CODE_RUNTIME_ERROR) 
    
    input_data_str = sys.argv[1]
    script_to_run = sys.argv[2] 
    
    if len(sys.argv) > 3:
        try:
            seed_val = int(sys.argv[3])
            random.seed(seed_val)
        except ValueError:
            pass 
    else:
        random.seed(42) 

    script_content = sys.stdin.read()
    
    original_stdout = sys.stdout
    sys.stdout = redirected_stdout
    original_stdin = sys.stdin
    
    if input_data_str:
        input_data = input_data_str.replace("\\n", "\n")
        if not input_data.endswith("\n"):
            input_data += "\n"
        sys.stdin = EchoingStringIO(input_data)
    else:
        sys.stdin = EchoingStringIO("")
    
    scope = {}
    
    try:
        try:
            main_code_object = compile(script_content, script_to_run, 'exec')
        except (SyntaxError, IndentationError, TabError) as e:
            # Syntax errors are fatal immediately (cannot trace them)
            print(f"Syntax Error: {e}", file=sys.stderr)
            sys.exit(EXIT_CODE_SYNTAX_ERROR)
            
        main_filename = os.path.normcase(os.path.abspath(main_code_object.co_filename))
        sys.settrace(tracer)
        exec(main_code_object, scope, scope)
        
    except Exception as e:
        # --- THIS IS THE CHANGE ---
        # We caught a runtime error.
        # 1. Restore stdout so we can print the error to the real console (stderr)
        sys.stdout = original_stdout 
        sys.stdin = original_stdin 
        
        # 2. Print the error message for the Visualizer to capture
        print(f"Error during script execution: {e}", file=sys.stderr)
        
        # 3. Set the exit code to ERROR, but DO NOT EXIT YET.
        #    We still want to print the JSON trace below.
        final_exit_code = EXIT_CODE_RUNTIME_ERROR
        # --------------------------
        
    finally:
        # Restore everything
        sys.settrace(None)
        # If we didn't crash, these might still need restoring
        if sys.stdout != original_stdout:
            sys.stdout = original_stdout
        if sys.stdin != original_stdin:
            sys.stdin = original_stdin 
    
    # Get any final output pending in the buffer
    final_output = redirected_stdout.getvalue()
    
    # Add final state to the last step
    if execution_trace:
        execution_trace[-1]['output'] += final_output
        
        # Only try to grab final variables if scope is valid (might not be on crash)
        try:
            final_global_vars = safe_serialize(scope)
            execution_trace[-1]['global_vars'] = final_global_vars
            if execution_trace[-1]['func_name'] == '<module>':
                execution_trace[-1]['local_vars'] = final_global_vars
        except:
            pass

    # Print the trace (even if it crashed partway through!)
    print(json.dumps(execution_trace, indent=2))
    
    # Exit with the correct code (0 for success, 1 for crash)
    sys.exit(final_exit_code)
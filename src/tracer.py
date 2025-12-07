import sys
import json
import io
import os
import random 
import time

redirected_stdout = io.StringIO()
execution_trace = []
main_filename = None
start_time = time.time()

# --- LIMITS ---
TIME_LIMIT = 5.0      # <--- UPDATED: Stop execution after 5 seconds
MAX_STEPS = 5000      # Stop execution after 5000 steps
step_counter = 0      
# --------------

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
    global step_counter

    # --- Check Limits ---
    step_counter += 1
    if step_counter > MAX_STEPS:
        raise TimeoutError(f"Execution exceeded {MAX_STEPS} steps.")
        
    if time.time() - start_time > TIME_LIMIT:
        raise TimeoutError(f"Execution exceeded {TIME_LIMIT} seconds.")
    # --------------------

    if event == 'call':
        try:
            frame_filename = os.path.normcase(os.path.abspath(frame.f_code.co_filename))
        except Exception:
            return None 
        
        if frame_filename != main_filename:
            return None 
        
        return tracer 
    
    if event == 'line':
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

if __name__ == "__main__":
    #global main_filename

    EXIT_CODE_SUCCESS = 0
    EXIT_CODE_RUNTIME_ERROR = 1
    EXIT_CODE_SYNTAX_ERROR = 2

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
            print(f"Syntax Error: {e}", file=sys.stderr)
            sys.exit(EXIT_CODE_SYNTAX_ERROR)
            
        main_filename = os.path.normcase(os.path.abspath(main_code_object.co_filename))
        sys.settrace(tracer)
        exec(main_code_object, scope, scope)
        
    except Exception as e:
        sys.stdout = original_stdout 
        sys.stdin = original_stdin 
        print(f"Trace Stopped: {e}", file=sys.stderr)
        final_exit_code = EXIT_CODE_RUNTIME_ERROR
        
    finally:
        sys.settrace(None)
        if sys.stdout != original_stdout:
            sys.stdout = original_stdout
        if sys.stdin != original_stdin:
            sys.stdin = original_stdin 
    
    final_output = redirected_stdout.getvalue()
    
    if execution_trace:
        execution_trace[-1]['output'] += final_output
        try:
            final_global_vars = safe_serialize(scope)
            execution_trace[-1]['global_vars'] = final_global_vars
            if execution_trace[-1]['func_name'] == '<module>':
                execution_trace[-1]['local_vars'] = final_global_vars
        except:
            pass

    print(json.dumps(execution_trace, indent=2))
    sys.exit(final_exit_code)
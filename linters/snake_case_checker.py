from pylint.checkers import BaseChecker
from pylint.lint import PyLinter

import re

SNAKE_CASE_REGEX = re.compile(r'^[a-z_][a-z0-9_]*$') # Must begin with letter or underscore, all lowercase
SCREAMING_SNAKE_CASE_REGEX = re.compile(r'^[A-Z_][A-Z0-9_]*$') # Same, but uppercase, for constants

class SnakeCaseChecker(BaseChecker) :
    name = "snake-case-checker"
    priority = -1 # Executes later
    msgs = { # Message for students
        "C9000": ( # Message ID, C=convention, list ends at C0414
            "Variable name '%s' should be in snake_case.",
            "invalid-variable-name-snake-case",
            "Used when a variable name is not snake_case.",
        ),
    }
    
    def visit_assign(self, node):
        for target in node.targets :
            if hasattr(target, "name") :
                name = target.name
                if not SNAKE_CASE_REGEX.match(name) and not SCREAMING_SNAKE_CASE_REGEX.match(name) :
                    self.add_message("invalid-variable-name-snake-case", node=target, args=(name,))
                    
    def visit_functiondef(self, node):
        # Check function name
        func_name = node.name
        if not SNAKE_CASE_REGEX.match(func_name):
            self.add_message("invalid-variable-name-snake-case", node=node, args=(func_name,))

        # Check parameter names
        for arg in node.args.args:  # Regular parameters
            if not SNAKE_CASE_REGEX.match(arg.arg):
                self.add_message("invalid-variable-name-snake-case", node=arg, args=(arg.arg,))

        if node.args.vararg:  # *args
            if not SNAKE_CASE_REGEX.match(node.args.vararg.arg):
                self.add_message("invalid-variable-name-snake-case", node=node.args.vararg, args=(node.args.vararg.arg,))

        if node.args.kwarg:  # **kwargs
            if not SNAKE_CASE_REGEX.match(node.args.kwarg.arg):
                self.add_message("invalid-variable-name-snake-case", node=node.args.kwarg, args=(node.args.kwarg.arg,))
                
    def visit_asyncfunctiondef(self, node):
        self.visit_functiondef(node)


def register(linter: PyLinter): # Necessary to register the checker with the linter
    linter.register_checker(SnakeCaseChecker(linter))
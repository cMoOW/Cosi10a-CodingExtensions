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
            
def register(linter: PyLinter): # Necessary to register the checker with the linter
    linter.register_checker(SnakeCaseChecker(linter))
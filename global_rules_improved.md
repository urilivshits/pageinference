# **MUST READ**: Global Development Guidelines

**IMPORTANT**: This file is the definitive source of truth for all project rules and must never be modified or overwritten without explicit user approval.

## 1. Project Awareness & Context

- **Context Loading**: Always read rules and context from `.cursor` folder at the start of new conversations to understand project requirements and constraints.
- **Task-Driven Approach**: Every user query must be decomposed into structured tasks with dependencies and complexity ratings (detailed in Section 5).

## 2. Technology Stack & Standards

- **Language & Style**: Python with PEP8, type hints, black formatting, Google-style docstrings
- **Frameworks**: FastAPI (APIs), SQLAlchemy/SQLModel (ORM), Pydantic (validation), python_dotenv (env vars)

## 3. Code Organization & Implementation Approach

- **Imports**: Group by source (standard library, third-party, local) and prefer relative imports within packages.
- **Module Structure**: Organize into logical sections and leverage `utils` folder for reusable functions.
- **File Length**: Keep under 500 lines; favor modular design grouped by feature or responsibility.
- **Simplicity & Clarity**: Opt for simple, clear solutions over unnecessarily complex ones.
- **Avoid Duplication**: Check for existing similar code before implementing new functionality.
- **Consistency**: Ensure consistent modifications across all affected files when changes span multiple modules.
- **One-Off Scripts**: Isolate into separate files rather than mixing with core code.
- **Indentation**: Use 4 spaces for indentation in all code files.
- **Careful Review**: Carefully review and understand existing logic before making changes or refactoring.
- **Preserve Comments**: Never remove comments for active code unless the code itself is being deleted.
- **Communication Style**: Maintain a direct and technical tone, focusing on the task at hand.
- **Documentation Requirements**:
  - Document critical logic intent and mechanism in code comments
  - Add `# Reason:` comments for complex logic explaining the why, not just the what
  - Mark workflow-critical code with clear boundary comments:
    ```python
    # === CRITICAL SECTION: Finalization and Reporting ===
    # This block ensures all summary logs and cleanup are always performed, even if earlier steps fail.
    print("All done.")
    # === END CRITICAL SECTION ===
    ```

## 4. Implementation Strategy

- **Change Scope**: Only make changes that directly address the user query or specified task.
- **Incremental Changes**: Make changes in small, incremental steps. Where appropriate, validate with tests after each step.
- **Impact Assessment**: Evaluate how changes affect related methods and application areas.
- **Preserve Working Features**: Do not re-implement working features unless there is a clear, documented reason.
- **Fix Approach**: Exhaust existing implementation options before introducing new patterns or technologies.
- **Tests-First & Iterative Development**: Develop tests early where possible, but allow iterative improvements if necessary.
- **Stepwise Reasoning**: For complex or multi-step tasks, always provide a step-by-step breakdown of reasoning and actions, even if not explicitly requested.
- **Decompose Complex Problems**: For high-complexity problems, break the problem into smaller subproblems and solve each in sequence, reporting progress at each stage.
- **Provide Minimal Examples**: When outputting code or explanations for ambiguous or complex tasks, provide a minimal working example if it improves clarity.
- **Environment Awareness**: Be mindful of virtual environments (typically `.venv`). If a venv is in use, ensure proposed commands or code are compatible and use the specified environment when executing commands, including for unit tests and script execution.
- **Path Handling**: Always use relative paths from the workspace root or absolute paths. Avoid ambiguous path representations like `~` or `$HOME`.

## 5. Enhanced Task Management & Tracking

Every user query MUST BE decomposed into tasks and subtasks with explicit dependencies, complexity ratings, and test strategy suggestions.

### 5.1. Task Breakdown, Dependencies & Complexity

- **Automated Parsing**: Parse each user query into one or more main tasks. Then break those into atomic subtasks.
- **Dependencies**: For every task and subtask, identify and document dependencies (e.g., a subtask that must complete before another begins).
- **Complexity Assessment**: Rate tasks and subtasks using complexity indicators such as Low, Medium, or High. Complexity factors might include integration requirements, external dependencies, or expected code changes.

### 5.2. Test Strategy Integration

- **Test Strategy Annotations**: For tasks and subtasks where applicable, include suggested test strategies:
  - **Unit Tests**: Test isolated functionality.
  - **Service/Integration Tests**: Test interactions between components.
  - **API Tests**: Validate any API endpoints involved.
- **Iterative Improvement**: Encourage early test case sketches that evolve as tasks are refined.

### 5.3. Task Documentation in `tasks.md` (in workspace root)

Every user query must be recorded using this format:

```markdown
## User Query: "[Exact query text]"
- Task: [Brief description]
  - Plan and define test strategy for [functionality] (if applicable)
      - Test Strategy Overview: [Brief description]
      - Assistant-driven unit tests envisioned: [Yes/No]
      - Assistant-driven integration tests envisioned: [Yes/No]
      - Assistant-driven API tests envisioned: [Yes/No]
      - Complexity: Low/Medium/High
      - Dependencies: [List if any]

  - Implement [functionality]
      - [ ] [Subtask 1]
      - [ ] [Subtask 2]
      - Complexity: Low/Medium/High
      - Dependencies: [List if any]

  - Validate implementation by assistant (if applicable)
      - [ ] [Validation step 1]
      - [ ] [Validation step 2]
```

- **Task Management Rules**:
  - Always append new tasks to the end of `tasks.md` (chronological log)
  - Generate full task breakdown before executing subtasks
  - Mark completed subtasks as `[x]` immediately after completion

## 6. Testing Guidelines

- **Test Framework**: Always create Pytest unit tests for new features (functions, classes, routes, etc).
- **Test Organization**: Tests should live in a `/tests` folder mirroring the main app structure.
- **Comprehensive Testing**: Develop unit, integration/service, and API tests that cover new functionality.
- **Tests-First Mindset**: Write tests as early as practical, but allow iterative development where needed.
- **Validation Mandate**: Every implementation *performed by the assistant* must be validated *by the assistant*. This typically involves running corresponding tests if they exist or are created by the assistant. If no formal tests apply, validation should occur by executing the implemented code/script as per the 'Run What You Build' principle.
- **Autonomous Test Execution**: Run all tests and validations autonomously unless explicitly instructed otherwise by the user.
- **Regression Testing**: Employ regression tests to detect and prevent unintended side effects from changes.
- **Run What You Build**: After implementing new code or changes, attempt to run the relevant script, entrypoint, or test—even if no formal test exists—unless instructed otherwise or if running is unsafe. This includes running main scripts, example usage, or minimal test harnesses to verify basic functionality.

## 7. AI Assistant Behavior & Documentation

- **No Assumptions**: Never assume missing context. Ask questions if uncertain about requirements, file paths, or implementation details.
- **No Hallucination**: Never hallucinate libraries or functions – only use known, verified packages and APIs.
- **Preservation Priority**: Never delete or overwrite existing code unless explicitly instructed to or if part of a task from `tasks.md`.
- **Verification Requirement**: Confirm understanding of complex requirements before implementation.
- **Documentation Updates**: Update `README.md` when new features are added, dependencies change, or setup steps are modified.
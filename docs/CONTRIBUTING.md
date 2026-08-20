# Contributing to Routier Documentation

Thank you for your interest in contributing to the Routier framework documentation! This guide will help you get started.

## 📝 How to Contribute

### 1. Reporting Issues

If you find a bug or have a suggestion for improvement:

- Check if the issue already exists
- Create a new issue with a clear description
- Include steps to reproduce if it's a bug
- Add labels to categorize the issue

### 2. Suggesting Improvements

- Open a discussion for new features or improvements
- Provide use cases and examples
- Consider the impact on existing functionality

### 3. Contributing Code

- Fork the repository
- Create a feature branch
- Make your changes
- Add tests if applicable
- Submit a pull request

## 🏗️ Documentation Structure

The documentation follows this structure:

```
docs/
├── quick-start/          # Getting started guides
├── core-concepts/        # Core framework concepts
├── plugins/              # Plugin documentation
├── data-operations/      # CRUD and data operations
├── react-integration/    # React-specific guides
├── advanced-features/    # Advanced functionality
├── guides-examples/      # Practical guides and examples
├── reference/            # API reference and configuration
├── examples/             # Code examples
└── demos/                # Interactive demos
```

## ✍️ Writing Guidelines

### Style Guide

- Use clear, concise language
- Include code examples
- Use proper Markdown formatting
- Add emojis for visual appeal
- Keep paragraphs short and focused

### Code Examples

- Use TypeScript for examples
- Include both simple and complex scenarios
- Add comments for clarity
- Test examples before committing

### File Naming

- Use kebab-case for file names
- Use descriptive names
- Include `.md` extension
- Use `README.md` for directory overviews

## 🔧 Local Development

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Start the development server: `npm run docs:dev`

If the install fails on `leveldown` with `No module named 'distutils'`, your Python is 3.12 or
newer and the bundled `node-gyp` predates its removal. Either install a provider
(`python3 -m pip install setuptools`) or use `npm install --ignore-scripts` followed by
`npm rebuild sqlite3`. See `specs/RELEASING.md` for the detail — nothing in the repository
needs the `leveldown` binding.

### Testing

- Test all links work correctly
- Verify code examples compile
- Check Markdown formatting
- Test on different devices/browsers

## 📋 Pull Request Checklist

Before submitting a pull request:

- [ ] Documentation follows the style guide
- [ ] All links work correctly
- [ ] Code examples are tested
- [ ] Changes are properly formatted
- [ ] Commit messages are descriptive
- [ ] Branch is up to date with main

## 🎯 Areas That Need Help

- More code examples
- Performance optimization guides
- Real-world use case studies
- Troubleshooting guides
- Migration guides
- API documentation

## 📞 Getting Help

If you need help contributing:

- Join our [Discussions](https://github.com/your-username/routier/discussions)
- Open an issue for questions
- Check existing documentation
- Review other contributions

## 🙏 Recognition

All contributors will be recognized in:

- The project README
- Release notes
- Contributor hall of fame
- Documentation acknowledgments

Thank you for helping make Routier documentation better for everyone!

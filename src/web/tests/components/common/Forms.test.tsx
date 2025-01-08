import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react'; // ^14.0.0
import userEvent from '@testing-library/user-event'; // ^14.0.0
import { axe, toHaveNoViolations } from 'jest-axe'; // ^4.7.0
import FormField from '../../src/components/common/Forms/FormField';
import SearchField from '../../src/components/common/Forms/SearchField';
import SelectField from '../../src/components/common/Forms/SelectField';

// Extend Jest matchers for accessibility testing
expect.extend(toHaveNoViolations);

// Mock tenant context for multi-tenant testing
const mockTenantContext = {
  id: 'tenant-123',
  validationRules: {
    maxLength: 50,
    required: true,
    pattern: /^[a-zA-Z0-9\s]*$/,
  },
  errorMessages: {
    required: 'This field is required',
    pattern: 'Only alphanumeric characters allowed',
    maxLength: 'Maximum length exceeded',
  },
};

describe('FormField Component', () => {
  // Standard props for testing
  const defaultProps = {
    name: 'test-field',
    label: 'Test Field',
    value: '',
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render with tenant-specific validation rules', () => {
    const { getByTestId } = render(
      <FormField
        {...defaultProps}
        required={mockTenantContext.validationRules.required}
        maxLength={mockTenantContext.validationRules.maxLength}
      />
    );

    const input = getByTestId('form-field-test-field');
    expect(input).toHaveAttribute('maxLength', '50');
    expect(input).toHaveAttribute('aria-required', 'true');
  });

  it('should handle input masking per tenant configuration', async () => {
    const { getByTestId } = render(<FormField {...defaultProps} />);
    const input = getByTestId('form-field-test-field');

    await userEvent.type(input, 'Test@123!');
    expect(defaultProps.onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({
          value: 'Test123',
        }),
      })
    );
  });

  it('should maintain WCAG 2.1 AA compliance', async () => {
    const { container } = render(<FormField {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should announce validation errors to screen readers', async () => {
    const { getByTestId, getByRole } = render(
      <FormField {...defaultProps} error={mockTenantContext.errorMessages.required} />
    );

    const errorMessage = getByRole('alert');
    expect(errorMessage).toHaveTextContent(mockTenantContext.errorMessages.required);
  });
});

describe('SearchField Component', () => {
  const mockOnSearch = jest.fn();
  const mockOnClear = jest.fn();

  const defaultProps = {
    value: '',
    onSearch: mockOnSearch,
    onClear: mockOnClear,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should debounce search with configured timeout', async () => {
    const { getByTestId } = render(
      <SearchField {...defaultProps} debounceMs={300} />
    );

    const input = getByTestId('search-input');
    await userEvent.type(input, 'test query');

    expect(mockOnSearch).not.toHaveBeenCalled();
    jest.advanceTimersByTime(300);
    expect(mockOnSearch).toHaveBeenCalledWith('test query');
  });

  it('should handle loading states accessibly', () => {
    const { getByRole } = render(
      <SearchField {...defaultProps} isLoading={true} />
    );

    const searchbox = getByRole('searchbox');
    expect(searchbox).toHaveAttribute('aria-busy', 'true');
  });

  it('should clear search with keyboard shortcuts', async () => {
    const { getByTestId } = render(
      <SearchField {...defaultProps} value="test query" />
    );

    const input = getByTestId('search-input');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(mockOnClear).toHaveBeenCalled();
  });

  it('should maintain WCAG 2.1 AA compliance in all states', async () => {
    const { container } = render(
      <SearchField {...defaultProps} isLoading={true} value="test" />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('SelectField Component', () => {
  const options = [
    { value: '1', label: 'Option 1' },
    { value: '2', label: 'Option 2' },
    { value: '3', label: 'Option 3' },
  ];

  const defaultProps = {
    name: 'test-select',
    label: 'Test Select',
    options,
    value: '',
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should support keyboard navigation', async () => {
    const { getByRole } = render(<SelectField {...defaultProps} />);
    const select = getByRole('button');

    // Open dropdown with keyboard
    fireEvent.keyDown(select, { key: 'ArrowDown' });
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    // Navigate options
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' });
    expect(screen.getByText('Option 1')).toHaveFocus();
  });

  it('should handle multi-select mode accessibly', async () => {
    const { getByRole } = render(
      <SelectField {...defaultProps} multiple value={[]} />
    );

    const select = getByRole('button');
    fireEvent.mouseDown(select);

    const options = screen.getAllByRole('option');
    await userEvent.click(options[0]);
    await userEvent.click(options[1]);

    expect(defaultProps.onChange).toHaveBeenCalledWith(['1', '2']);
  });

  it('should maintain WCAG 2.1 AA compliance with option groups', async () => {
    const { container } = render(
      <SelectField
        {...defaultProps}
        options={[
          { value: 'group1', label: 'Group 1' },
          { value: 'group2', label: 'Group 2' },
        ]}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should announce selected options to screen readers', async () => {
    render(<SelectField {...defaultProps} value="1" />);
    const select = screen.getByRole('button');
    expect(select).toHaveAttribute('aria-selected', 'true');
    expect(select).toHaveTextContent('Option 1');
  });
});
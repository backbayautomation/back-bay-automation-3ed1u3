import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react'; // ^14.0.0
import userEvent from '@testing-library/user-event'; // ^14.0.0
import { axe, toHaveNoViolations } from 'jest-axe'; // ^4.7.0
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'; // ^29.0.0

import FormField from '../../../src/components/common/Forms/FormField';
import SearchField from '../../../src/components/common/Forms/SearchField';
import SelectField from '../../../src/components/common/Forms/SelectField';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock tenant context
const mockTenantContext = {
  id: 'tenant-123',
  validationRules: {
    maxLength: 50,
    required: true,
    patterns: {
      email: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
    },
  },
  theme: {
    colors: {
      primary: '#0066CC',
      error: '#DC3545',
    },
  },
};

describe('FormField Component', () => {
  const mockOnChange = jest.fn();
  const mockOnBlur = jest.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
    mockOnBlur.mockClear();
  });

  it('should render with tenant-specific validation rules', () => {
    const { getByRole } = render(
      <FormField
        name="test-field"
        label="Test Field"
        value=""
        required={mockTenantContext.validationRules.required}
        onChange={mockOnChange}
        maxLength={mockTenantContext.validationRules.maxLength}
      />
    );

    const input = getByRole('textbox');
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(input).toHaveAttribute('maxLength', '50');
  });

  it('should handle input masking per tenant configuration', async () => {
    const { getByRole } = render(
      <FormField
        name="email"
        label="Email"
        value=""
        type="email"
        onChange={mockOnChange}
      />
    );

    const input = getByRole('textbox');
    await userEvent.type(input, 'test@example.com');
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ value: 'test@example.com' })
      })
    );
  });

  it('should display localized error messages accessibly', async () => {
    const { getByRole, getByText } = render(
      <FormField
        name="required-field"
        label="Required Field"
        value=""
        required
        error="This field is required"
        onChange={mockOnChange}
      />
    );

    const input = getByRole('textbox');
    const errorMessage = getByText('This field is required');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(errorMessage).toHaveAttribute('role', 'alert');
  });

  it('should pass accessibility audit', async () => {
    const { container } = render(
      <FormField
        name="accessible-field"
        label="Accessible Field"
        value=""
        onChange={mockOnChange}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('SearchField Component', () => {
  const mockOnSearch = jest.fn();
  const mockOnClear = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    mockOnSearch.mockClear();
    mockOnClear.mockClear();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should debounce search with configured timeout', async () => {
    const { getByRole } = render(
      <SearchField
        value=""
        onSearch={mockOnSearch}
        debounceMs={300}
      />
    );

    const searchInput = getByRole('searchbox');
    await userEvent.type(searchInput, 'test query');

    expect(mockOnSearch).not.toHaveBeenCalled();
    jest.advanceTimersByTime(300);
    expect(mockOnSearch).toHaveBeenCalledWith('test query');
  });

  it('should handle loading states accessibly', async () => {
    const { getByRole, getByLabelText } = render(
      <SearchField
        value=""
        onSearch={mockOnSearch}
        isLoading={true}
      />
    );

    const searchInput = getByRole('searchbox');
    const clearButton = getByLabelText('Clear search');

    expect(searchInput).toHaveAttribute('aria-busy', 'true');
    expect(clearButton).toBeDisabled();
  });

  it('should clear search with keyboard shortcuts', async () => {
    const { getByRole } = render(
      <SearchField
        value="test"
        onSearch={mockOnSearch}
        onClear={mockOnClear}
      />
    );

    const searchInput = getByRole('searchbox');
    fireEvent.keyDown(searchInput, { key: 'Escape' });

    expect(mockOnClear).toHaveBeenCalled();
  });
});

describe('SelectField Component', () => {
  const options = [
    { value: '1', label: 'Option 1' },
    { value: '2', label: 'Option 2' },
    { value: '3', label: 'Option 3' },
  ];

  const mockOnChange = jest.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('should support keyboard navigation in dropdown', async () => {
    const { getByRole } = render(
      <SelectField
        name="test-select"
        label="Test Select"
        options={options}
        value=""
        onChange={mockOnChange}
      />
    );

    const select = getByRole('combobox');
    await userEvent.tab();
    expect(select).toHaveFocus();

    // Open dropdown with keyboard
    fireEvent.keyDown(select, { key: 'ArrowDown' });
    
    // Navigate options
    const option1 = screen.getByText('Option 1');
    const option2 = screen.getByText('Option 2');
    
    expect(option1).toHaveFocus();
    fireEvent.keyDown(option1, { key: 'ArrowDown' });
    expect(option2).toHaveFocus();
  });

  it('should announce selected options correctly', async () => {
    const { getByRole } = render(
      <SelectField
        name="test-select"
        label="Test Select"
        options={options}
        value={['1', '2']}
        multiple={true}
        onChange={mockOnChange}
      />
    );

    const select = getByRole('combobox');
    expect(select).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Option 1, Option 2')
    );
  });

  it('should handle large option lists performantly', async () => {
    const manyOptions = Array.from({ length: 1000 }, (_, i) => ({
      value: `${i}`,
      label: `Option ${i}`,
    }));

    const { getByRole, queryAllByRole } = render(
      <SelectField
        name="large-select"
        label="Large Select"
        options={manyOptions}
        value=""
        onChange={mockOnChange}
      />
    );

    const select = getByRole('combobox');
    fireEvent.mouseDown(select);

    // Verify virtual scrolling or pagination is working
    const renderedOptions = queryAllByRole('option');
    expect(renderedOptions.length).toBeLessThan(manyOptions.length);
  });
});
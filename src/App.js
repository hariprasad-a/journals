import React from 'react'
import styled from 'styled-components'
import { useTable, useFilters, useGlobalFilter, useAsyncDebounce, usePagination} from 'react-table'

const Styles = styled.div`
  .table {
    table-layout:fixed;
  }

  i {
    font-size: 1rem !important;
  }

  .table tr {
    border-radius: 20px;
  }

  tr td:nth-child(n+4),
  tr th:nth-child(n+4) {
    border-radius: 0 .625rem .625rem 0;
  }

  tr td:nth-child(1),
  tr th:nth-child(1) {
    border-radius: .625rem 0 0 .625rem;
  }

  tr td:nth-child(n+5), {
    textAlign: 'center'
  }

  td[colspan]:not([colspan="1"]) {
    text-align: center;
  }

  .title {
    width: 450px;
    height: 60px;
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }

  .publisher {
    width: 450px;
    height: 60px;
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }

  .ranking {
    maxWidth: 5px;
    height: 60px;
    padding: 0.75rem;
    text-align: center;
    font-weight: bold;
  }

  .scopus {
    maxWidth: 5px;
    height: 60px;
    padding: 0.75rem;
    text-align: center;
  }

`

// Define a default UI for filtering
function GlobalFilter({
  preGlobalFilteredRows,
  globalFilter,
  setGlobalFilter,
}) {
  const count = preGlobalFilteredRows.length
  const [value, setValue] = React.useState(globalFilter)
  const onChange = useAsyncDebounce(value => {
    setGlobalFilter(value || undefined)
  }, 200)

  return (
    <span>
      Search:{' '}
      <input
        class="border border-gray-800 focus:border-blue-500 rounded w-full py-2 px-3 mr-4 text-black"
        value={value || ""}
        onChange={e => {
          setValue(e.target.value);
          onChange(e.target.value);
        }}
        placeholder={`${count} records...`}
        style={{
          fontSize: '1.1rem',
          border: '0',
        }}
      />
    </span>
  )
}

// Define a default UI for filtering
function DefaultColumnFilter({
  column: { filterValue, preFilteredRows, setFilter },
}) {
  const count = preFilteredRows.length

  return (
    <div class="relative inline-block w-full text-blue-700">
    <input
      class="border border-gray-800 focus:border-blue-500 rounded w-full py-2 px-3 mr-4 text-black"
      value={filterValue || ''}
      onChange={e => {
        setFilter(e.target.value || undefined) // Set undefined to remove the filter entirely
      }}
      placeholder={`Search ${count} records...`}
    />
    </div>
  )
}

// This is a custom filter UI for selecting
// a unique option from a list
function SelectColumnFilter({
  column: { filterValue, setFilter, preFilteredRows, id },
}) {
  // Calculate the options for filtering
  // using the preFilteredRows
  const options = React.useMemo(() => {
    const options = new Set()
    preFilteredRows.forEach(row => {
      options.add(row.values[id])
    })
    return [...options.values()]
  }, [id, preFilteredRows])

  // Render a multi-select box
  return (
    <div class="relative inline-block w-full text-blue-700">
    <select
      class="bg-blue-50 hover:bg-blue-100 text-blue-800 py-1 px-4 border border-blue-400 rounded shadow"
      value={filterValue}
      onChange={e => {
        setFilter(e.target.value || undefined)
      }}
    >
      <option value="">All</option>
      {options.map((option, i) => (
        <option key={i} value={option}>
          {option}
        </option>
      ))}
    </select>
    </div>
  )
}

const defaultPropGetter = () => ({})

// Our table component
function Table({ columns, data, getHeaderProps = defaultPropGetter,
  getColumnProps = defaultPropGetter,
  getRowProps = defaultPropGetter,
  getCellProps = defaultPropGetter }) {
  const filterTypes = React.useMemo(
    () => ({
      text: (rows, id, filterValue) => {
        return rows.filter(row => {
          const rowValue = row.values[id]
          return rowValue !== undefined
            ? String(rowValue)
                .toLowerCase()
                .startsWith(String(filterValue).toLowerCase())
            : true
        })
      },
    }),
    []
  )

  const defaultColumn = React.useMemo(
    () => ({
      minWidth: 5,
      width: 150,
      maxWidth: 400,
      Filter: DefaultColumnFilter,
    }),
    []
  )

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    prepareRow,
    state,
    visibleColumns,
    preGlobalFilteredRows,
    setGlobalFilter,
    page,
    canPreviousPage,
    canNextPage,
    pageOptions,
    pageCount,
    gotoPage,
    nextPage,
    previousPage,    
    state: { pageIndex },
  } = useTable(
    {
      columns,
      data,
      defaultColumn, // Be sure to pass the defaultColumn option
      filterTypes,
      initialState: { pageIndex: 0 },
    },
    useFilters, // useFilters!
    useGlobalFilter, // useGlobalFilter!
    usePagination
  )

  return (
    <div class="flex items-start justify-center min-h-screen bg-gray-900">
    <div class="col-span-12">
    <div class="text-indigo-500 text-center text-5xl font-bold py-8">Journals</div>
    <div class="overflow-auto lg:overflow-visible ">
      <table class="table-fixed table text-gray-400 border-separate space-y-6 text-sm min-h-full max-h-full " {...getTableProps()}>
        <thead class="my-12 bg-gray-800 text-gray-500">
          {headerGroups.map(headerGroup => (
            <tr {...headerGroup.getHeaderGroupProps()}>
              {headerGroup.headers.map(column => (
                <th class="p-3 " {...column.getHeaderProps([
                  {
                    className: column.className,
                    style: column.style,
                  },
                  getColumnProps(column),
                  getHeaderProps(column),
                  ])}>
                  {column.render('Header')}
                  {/* Render the columns filter UI */}
                  <div>{column.canFilter ? column.render('Filter') : null}</div>
                </th>
              ))}
            </tr>
          ))}
          <tr>
            <th class="p-3"
              colSpan={visibleColumns.length}
              style={{
                width: '200px',height: '60px',
                textAlign: 'left',
              }}
            >
              <GlobalFilter
                preGlobalFilteredRows={preGlobalFilteredRows}
                globalFilter={state.globalFilter}
                setGlobalFilter={setGlobalFilter}
              />
            </th>
          </tr>
        </thead>
        <div></div>
        <tbody {...getTableBodyProps()}>
          {page.map((row, i) => {
            prepareRow(row)
            return (
              <tr class="bg-gray-800" {...row.getRowProps()}>
                {row.cells.map(cell => {
                  return <td class="p-3" {...cell.getCellProps([
                      {
                        className: cell.column.className,
                        style: cell.column.style,
                      },
                      getColumnProps(cell.column),
                      getCellProps(cell),
                    ])}>{cell.render('Cell')}</td>
                })}
              </tr>
            )
          })}
        
      
      <tr>
      <td colspan="4" class="">
      <div class="p-3 justify-center">
        <button class="border border-teal-500 text-teal-500 rounded-sm font-semibold py-1 px-4 hover:bg-teal-500 hover:text-white disabled:opacity-50" onClick={() => gotoPage(0)} disabled={!canPreviousPage}>
          {'<<'}
        </button>{' '}
        <button class="border border-teal-500 text-teal-500 rounded-sm font-semibold py-1 px-4 hover:bg-teal-500 hover:text-white disabled:opacity-50" onClick={() => previousPage()} disabled={!canPreviousPage}>
          {'<'}
        </button>{' '}
        <button class="border border-teal-500 text-teal-500 rounded-sm font-semibold py-1 px-4 hover:bg-teal-500 hover:text-white disabled:opacity-50" onClick={() => nextPage()} disabled={!canNextPage}>
          {'>'}
        </button>{' '}
        <button class="border border-teal-500 text-teal-500 rounded-sm font-semibold py-1 px-4 hover:bg-teal-500 hover:text-white disabled:opacity-50" onClick={() => gotoPage(pageCount - 1)} disabled={!canNextPage}>
          {'>>'}
        </button>{' '}
        <span>
          Page{' '}
          <strong>
            {pageIndex + 1} of {pageOptions.length}
          </strong>{' '}
        </span>
        <span>
          <span class="">
            | Go to page:{' '}
            <input
              class="border border-gray-800 focus:border-blue-500 rounded w-full py-1 px-3 mr-4 text-black"
              type="number"
              defaultValue={pageIndex + 1}
              onChange={e => {
                const page = e.target.value ? Number(e.target.value) - 1 : 0
                gotoPage(page)
              }}
              style={{ width: '100px' }}
            />
          </span>{' '}
        </span>
      </div>
      </td>
      </tr>
      </tbody>
      </table>
    </div>
    </div>
    </div>
  )
}

function ranking({ value}) {
  return <div class={value === 'A*' ? 'text-green-500' : (value === 'A' ? 'text-yellow-300' : (value === 'B' ? 'text-yellow-600' : 'text-red-800'))}> {value} </div>
}

function scopus({ value}) {
  return <div class={value === 'True' ? 'text-green-400' : 'text-red-400'}> {value} </div>
}

function App() {
  const columns = React.useMemo(
    () => [
          {
            Header: 'Title',
            accessor: 'Title',
            className:'title',
          },
          {
            Header: 'Publisher',
            accessor: 'Publisher',
            className:'publisher',
          },        
          {
            Header: 'ABDC Ranking',
            accessor: 'ABDC ranking',
            Filter: SelectColumnFilter,
            filter: 'equals',
            className: 'ranking',
            Cell: ranking,
          },
          {
            Header: 'Scopus listed',
            accessor: 'scopus',
            Filter: SelectColumnFilter,
            filter: 'includes',
            className: 'scopus',
            Cell: scopus,
          }
    ],
    []
  )

  const data = React.useMemo(() => require('./data.json'), [])

  return (
    <Styles>
      <Table
        columns={columns}
        data={data}
      />
    </Styles>
  )
}

export default App
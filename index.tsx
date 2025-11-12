// index.tsx
import { render, h } from "preact";
import { useState, useEffect, useRef, useMemo } from "preact/hooks";
import htm from "htm";
import { GoogleGenAI, Type } from "@google/genai";

const html = htm.bind(h);

declare var Chart: any;
declare var XLSX: any;

type Invoice = {
  nombre_cliente: string;
  monto_factura: number;
  dias_vencida: number;
  vendedor: string;
};

type ClientSummary = {
  nombre_cliente: string;
  totalDebt: number;
  invoiceCount: number;
  weightedAvgDays: number;
};

// --- API Key Management ---
const ApiKeyScreen = ({ onKeySubmit }) => {
  const [apiKey, setApiKey] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (apiKey.trim()) {
      onKeySubmit(apiKey.trim());
    }
  };

  return html`
    <div class="api-key-container">
      <div class="card">
        <h2>Primer Paso: Conecta tu Clave de API</h2>
        <p>
          Por favor, ingresa tu clave de la API de Google AI Studio para
          continuar. Tu clave se guardará de forma segura en tu navegador para
          futuras sesiones.
        </p>
        <form onSubmit=${handleSubmit} class="api-key-form">
          <input
            type="password"
            placeholder="Pega tu clave de API aquí"
            value=${apiKey}
            onInput=${(e) => setApiKey(e.target.value)}
            required
          />
          <button type="submit">Guardar Clave y Empezar a Analizar</button>
        </form>
        <p class="api-key-info">
          Puedes obtener tu clave desde
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            >Google AI Studio</a
          >.
        </p>
      </div>
    </div>
  `;
};

// --- Chart Components ---
const ChartComponent = ({ type, data, options, chartRef, onChartClick }) => {
  useEffect(() => {
    if (!chartRef.current) return;
    let chart;
    const ctx = chartRef.current.getContext("2d");

    if (chartRef.current.chart) {
      chartRef.current.chart.destroy();
    }
    const chartOptions = {
      ...options,
      onClick: (e, elements) => {
        if (onChartClick && elements.length > 0) {
          const elementIndex = elements[0].index;
          const label = chart.data.labels[elementIndex];
          onChartClick(label);
        } else if (onChartClick) {
          onChartClick(null); // Clear filter when clicking empty space
        }
      },
    };
    chart = new Chart(ctx, { type, data, options: chartOptions });
    chartRef.current.chart = chart;

    return () => {
      if (chart) chart.destroy();
    };
  }, [data, options, type, onChartClick]);
  return html`<canvas ref=${chartRef}></canvas>`;
};

// --- UI Components ---
const FeedbackMsg = ({ msg, isError = false }) =>
  html`
    <div class="feedback-msg ${isError ? "error" : "success"}">${msg}</div>
  `;

const KpiCard = ({ title, value, subtext }) => {
  return html`
    <div class="card kpi-card">
      <h3>${title}</h3>
      <p class="value">${value}</p>
      ${subtext && html`<p class="subtext">${subtext}</p>`}
    </div>
  `;
};

const TopDebtorsCard = ({ topDebtors }) => {
  const top5Total = topDebtors.reduce(
    (sum, debtor) => sum + parseFloat(debtor.monto_factura),
    0
  );
  return html`
    <div class="card top-debtors-card">
      <h3>🏆 Top 5 Clientes Deudores</h3>
      <div class="top-debtors-total">
        <span>Total Top 5</span>
        <strong
          >$${top5Total.toLocaleString("es-CO", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}</strong
        >
      </div>
      <ol>
        ${topDebtors.map(
          (debtor) => html`
            <li>
              <span>${debtor.nombre_cliente}</span>
              <strong
                >$${parseFloat(debtor.monto_factura).toLocaleString("es-CO", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}</strong
              >
            </li>
          `
        )}
      </ol>
    </div>
  `;
};

const ClientSummaryTable = ({
  clientSummary,
  onSort,
  sortConfig,
  onGenerateReminder,
  activeFilters,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSummary = clientSummary.filter((client) =>
    client.nombre_cliente.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getSortArrow = (key) => {
    if (!sortConfig || sortConfig.key !== key) return "";
    return sortConfig.direction === "ascending" ? " ▲" : " ▼";
  };

  const getFilterText = () => {
    const filters = [];
    if (activeFilters && activeFilters.salesperson)
      filters.push(`Vendedor: ${activeFilters.salesperson}`);
    if (activeFilters && activeFilters.age)
      filters.push(`Antigüedad: ${activeFilters.age}`);
    if (filters.length === 0) return "";
    return html`<span class="active-filter-text">
      (Filtro: ${filters.join(", ")})</span
    >`;
  };

  return html`
    <div class="card client-summary-container">
      <h2>Resumen de Deuda por Cliente${getFilterText()}</h2>
      <input
        type="text"
        placeholder="Buscar cliente..."
        class="search-input"
        value=${searchTerm}
        onInput=${(e) => setSearchTerm(e.target.value)}
      />
      <div class="table-wrapper">
        <table class="invoice-table">
          <thead>
            <tr>
              <th onClick=${() => onSort("nombre_cliente")}>
                Cliente${getSortArrow("nombre_cliente")}
              </th>
              <th onClick=${() => onSort("totalDebt")}>
                Deuda Total${getSortArrow("totalDebt")}
              </th>
              <th onClick=${() => onSort("invoiceCount")}>
                # Facturas${getSortArrow("invoiceCount")}
              </th>
              <th onClick=${() => onSort("weightedAvgDays")}>
                Antigüedad Prom. Ponderada${getSortArrow("weightedAvgDays")}
              </th>
              <th class="actions-column">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${filteredSummary.map(
              (client) => html`
                <tr>
                  <td>${client.nombre_cliente}</td>
                  <td>
                    $${client.totalDebt.toLocaleString("es-CO", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td>${client.invoiceCount}</td>
                  <td>${client.weightedAvgDays.toFixed(0)} días</td>
                  <td>
                    <button
                      class="action-button"
                      title="Generar recordatorio por email"
                      onClick=${() => onGenerateReminder(client)}
                    >
                      Generar Recordatorio de Cobro
                    </button>
                  </td>
                </tr>
              `
            )}
          </tbody>
        </table>
      </div>
    </div>
  `;
};

const InvoiceTable = ({ invoices, onSort, sortConfig, title }) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredInvoices = invoices.filter((invoice) =>
    invoice.nombre_cliente.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getSortArrow = (key) => {
    if (!sortConfig || sortConfig.key !== key) return "";
    return sortConfig.direction === "ascending" ? " ▲" : " ▼";
  };

  return html`
    <div class="card invoice-table-container">
      <h2>${title || "Detalle de Facturas"}</h2>
      <input
        type="text"
        placeholder="Buscar cliente en facturas..."
        class="search-input"
        value=${searchTerm}
        onInput=${(e) => setSearchTerm(e.target.value)}
      />
      <div class="table-wrapper">
        <table class="invoice-table">
          <thead>
            <tr>
              <th onClick=${() => onSort("nombre_cliente")}>
                Cliente${getSortArrow("nombre_cliente")}
              </th>
              <th onClick=${() => onSort("monto_factura")}>
                Monto${getSortArrow("monto_factura")}
              </th>
              <th onClick=${() => onSort("dias_vencida")}>
                Días Vencida${getSortArrow("dias_vencida")}
              </th>
              <th onClick=${() => onSort("vendedor")}>
                Vendedor${getSortArrow("vendedor")}
              </th>
            </tr>
          </thead>
          <tbody>
            ${filteredInvoices.map(
              (invoice) => html`
                <tr>
                  <td>${invoice.nombre_cliente}</td>
                  <td>
                    $${invoice.monto_factura.toLocaleString("es-CO", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td>${invoice.dias_vencida}</td>
                  <td>${invoice.vendedor}</td>
                </tr>
              `
            )}
          </tbody>
        </table>
      </div>
    </div>
  `;
};

const FileUploadScreen = ({ onFile, feedback, onUseSampleData }) => {
  const [dragging, setDragging] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const fileInputRef = useRef(null);

  const handleDragEvent = (e, isEntering) => {
    e.preventDefault();
    e.stopPropagation();
    if (!companyName) return;
    setDragging(isEntering);
  };

  const handleDrop = (e) => {
    handleDragEvent(e, false);
    if (!companyName) return;
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      onFile(files[0], companyName);
    }
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files && files[0]) {
      onFile(files[0], companyName);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return html`
    <div class="file-upload-container">
      <div class="header">
        <h1>Análisis Interactivo de Cuentas por Cobrar</h1>
        <p>
          Sube un archivo (CSV, Excel) para generar métricas, gráficos e
          insights sobre el estado de tu cartera de clientes.
        </p>
      </div>
      ${feedback && html`<${FeedbackMsg} ...${feedback} />`}
      <div class="setup-container">
        <input
          type="text"
          placeholder="Ingresa el nombre de tu empresa"
          class="company-name-input"
          value=${companyName}
          onInput=${(e) => setCompanyName(e.target.value)}
        />
        <div
          class="file-upload-box ${dragging ? "drag-over" : ""} ${!companyName
            ? "disabled"
            : ""}"
          onDragEnter=${(e) => handleDragEvent(e, true)}
          onDragLeave=${(e) => handleDragEvent(e, false)}
          onDragOver=${(e) => handleDragEvent(e, true)}
          onDrop=${handleDrop}
          onClick=${() => companyName && fileInputRef.current?.click()}
          title=${!companyName
            ? "Por favor, primero ingresa el nombre de la empresa"
            : "Sube tu archivo"}
        >
          <p>Arrastra y suelta tu archivo CSV o Excel aquí</p>
          <p>o</p>
          <button type="button" disabled=${!companyName}>
            Selecciona un archivo
          </button>
          <input
            type="file"
            ref=${fileInputRef}
            onChange=${handleFileSelect}
            accept=".csv,.xlsx,.xls"
            style=${{ display: "none" }}
          />
        </div>
      </div>
      <div class="sample-data-container">
        <p>
          ¿No tienes un archivo a mano?
          <button onClick=${onUseSampleData} class="sample-data-button">
            Prueba con nuestros datos de ejemplo
          </button>
        </p>
      </div>
      <div class="info-box" style=${{ marginTop: "2rem", maxWidth: "600px" }}>
        <p><strong>Formato de datos esperado:</strong></p>
        <p>
          Tu archivo debe tener una cabecera con las columnas:
          <code>nombre_cliente</code>, <code>monto_factura</code>,
          <code>dias_vencida</code>, y <code>vendedor</code>.
        </p>
        <p>
          <strong>Privacidad:</strong> Tus datos se procesan localmente en tu
          navegador y no se guardan en ningún servidor.
        </p>
      </div>
    </div>
  `;
};

const Dashboard = ({
  data,
  fullData,
  analysis,
  isLoading,
  error,
  onGenerateReminder,
  companyName,
}) => {
  const [activeFilters, setActiveFilters] = useState<{
    age?: string;
    salesperson?: string;
  }>({});
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Invoice;
    direction: "ascending" | "descending";
  }>({ key: "monto_factura", direction: "descending" });
  const [clientSortConfig, setClientSortConfig] = useState<{
    key: keyof ClientSummary;
    direction: "ascending" | "descending";
  }>({ key: "totalDebt", direction: "descending" });

  const { top5Invoices, displayedClientSummary } = useMemo(() => {
    let baseInvoices = [...fullData];

    if (activeFilters.age) {
      baseInvoices = baseInvoices.filter((inv) => {
        const days = inv.dias_vencida;
        if (activeFilters.age === "0-30 días") return days <= 30;
        if (activeFilters.age === "31-60 días") return days > 30 && days <= 60;
        if (activeFilters.age === "61-90 días") return days > 60 && days <= 90;
        if (activeFilters.age === "91+ días") return days > 90;
        return true;
      });
    }
    if (activeFilters.salesperson) {
      baseInvoices = baseInvoices.filter(
        (inv) => inv.vendedor === activeFilters.salesperson
      );
    }

    let summaryToDisplay;
    if (Object.keys(activeFilters).length > 0) {
      const filteredClientData = {};
      baseInvoices.forEach((row) => {
        const amount = row.monto_factura;
        const days = row.dias_vencida;
        const clientName = row.nombre_cliente;
        if (!filteredClientData[clientName]) {
          filteredClientData[clientName] = {
            totalDebt: 0,
            invoiceCount: 0,
            weightedDaysSum: 0,
          };
        }
        filteredClientData[clientName].totalDebt += amount;
        filteredClientData[clientName].invoiceCount += 1;
        filteredClientData[clientName].weightedDaysSum += days * amount;
      });
      summaryToDisplay = Object.keys(filteredClientData).map((name) => ({
        nombre_cliente: name,
        totalDebt: filteredClientData[name].totalDebt,
        invoiceCount: filteredClientData[name].invoiceCount,
        weightedAvgDays:
          filteredClientData[name].totalDebt > 0
            ? filteredClientData[name].weightedDaysSum /
              filteredClientData[name].totalDebt
            : 0,
      }));
    } else {
      summaryToDisplay = [...data.clientSummary];
    }

    // Get Top 5 invoices
    const top5ClientNames = data.topDebtors.map((d) => d.nombre_cliente);
    const calculatedTop5Invoices = fullData
      .filter((invoice) => top5ClientNames.includes(invoice.nombre_cliente))
      .sort((a, b) => b.monto_factura - a.monto_factura);

    return {
      top5Invoices: calculatedTop5Invoices,
      displayedClientSummary: summaryToDisplay,
    };
  }, [fullData, activeFilters, data.clientSummary, data.topDebtors]);

  const sortedClientSummary = useMemo(() => {
    const summary = [...displayedClientSummary];
    if (clientSortConfig !== null) {
      summary.sort((a, b) => {
        const aValue = a[clientSortConfig.key];
        const bValue = b[clientSortConfig.key];
        if (aValue < bValue)
          return clientSortConfig.direction === "ascending" ? -1 : 1;
        if (aValue > bValue)
          return clientSortConfig.direction === "ascending" ? 1 : -1;
        return 0;
      });
    }
    return summary;
  }, [displayedClientSummary, clientSortConfig]);

  const handleSort = (key: keyof Invoice) => {
    let direction: "ascending" | "descending" = "ascending";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "ascending"
    ) {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const handleClientSort = (key: keyof ClientSummary) => {
    let direction: "ascending" | "descending" = "ascending";
    if (
      clientSortConfig &&
      clientSortConfig.key === key &&
      clientSortConfig.direction === "ascending"
    ) {
      direction = "descending";
    }
    setClientSortConfig({ key, direction });
  };

  const handlePrint = () => {
    window.print();
  };

  return html`
    <div class="printable-area">
      <div class="header">
        <h1>Panel de Cuentas por Cobrar</h1>
        <p>
          Análisis del estado de la cartera de ${companyName} al
          ${new Date().toLocaleDateString("es-CO")}
        </p>
        <button class="print-button" onClick=${handlePrint}>
          🖨️ Imprimir / Guardar Reporte
        </button>
        ${Object.keys(activeFilters).length > 0 &&
        html`
          <div class="active-filters-container">
            <button
              class="clear-filter-button"
              onClick=${() => setActiveFilters({})}
            >
              ❌ Limpiar Filtros
            </button>
          </div>
        `}
      </div>
      <div class="dashboard-grid">
        <${KpiCard}
          title="Saldo Total por Cobrar"
          value=${`$${data.totalReceivable.toLocaleString("es-CO", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`}
        />
        <${KpiCard}
          title="Facturas Vencidas"
          value=${data.totalInvoices.toLocaleString("es-CO")}
        />
        <${KpiCard}
          title="Saldo Vencido a +90 Días"
          value=${`$${data.debtOver90Days.toLocaleString("es-CO", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`}
          subtext="Cartera de mayor riesgo"
        />
        <${KpiCard}
          title="Riesgo de Concentración"
          value=${`${data.concentrationRisk.toFixed(1)}%`}
          subtext="En Top 5 Clientes"
        />

        <${InvoiceTable}
          invoices=${top5Invoices}
          onSort=${handleSort}
          sortConfig=${sortConfig}
          title="Detalle Facturas Individuales Top 5"
        />
        <${TopDebtorsCard} topDebtors=${data.topDebtors} />

        ${isLoading &&
        html`
          <div class="card loader-container" style=${{ gridColumn: "1 / -1" }}>
            <div class="loader"></div>
            <p>Gemini está analizando los datos de tu empresa...</p>
          </div>
        `}
        ${error &&
        html`
          <${FeedbackMsg} msg="Error de Análisis: ${error}" isError=${true} />
        `}
        ${analysis &&
        !isLoading &&
        html`
          <div
            class="card analysis-section portfolio-health ${(
              analysis.portfolioHealth?.status || ""
            )
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")}"
          >
            <h2>Diagnóstico de Cartera</h2>
            ${analysis.portfolioHealth &&
            html`
              <p class="status">${analysis.portfolioHealth.status}</p>
              <p>${analysis.portfolioHealth.reason}</p>
            `}
          </div>
          <div class="card analysis-section">
            <h2>🚀 Recomendaciones</h2>
            <ul>
              ${Array.isArray(analysis.recommendations) &&
              analysis.recommendations.map((item) => html`<li>${item}</li>`)}
            </ul>
          </div>
        `}

        <${ClientSummaryTable}
          clientSummary=${sortedClientSummary}
          onSort=${handleClientSort}
          sortConfig=${clientSortConfig}
          onGenerateReminder=${onGenerateReminder}
          activeFilters=${activeFilters}
        />
      </div>
    </div>
  `;
};

const ReminderModal = ({
  client,
  onClose,
  onCopy,
  copySuccess,
  companyName,
  generateReminder,
  reminderContent,
  isGenerating,
}) => {
  const [editedContent, setEditedContent] = useState("");

  useEffect(() => {
    setEditedContent(reminderContent);
  }, [reminderContent]);

  return html`
    <div class="modal-backdrop" onClick=${onClose}>
      <div class="modal-content" onClick=${(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>Asistente de Comunicación para ${client.nombre_cliente}</h2>
          <button class="close-button" onClick=${onClose}>&times;</button>
        </div>
        <div class="modal-body">
          <p class="modal-instructions">
            Selecciona el tono del mensaje y la IA lo redactará por ti:
          </p>
          <div class="generation-controls">
            <button
              onClick=${() => generateReminder("friendly")}
              disabled=${isGenerating}
            >
              Recordatorio Amistoso
            </button>
            <button
              onClick=${() => generateReminder("persuasive")}
              disabled=${isGenerating}
            >
              Cobro Persuasivo
            </button>
            <button
              onClick=${() => generateReminder("payment_plan")}
              disabled=${isGenerating}
            >
              Proponer Plan de Pagos
            </button>
          </div>
          <div class="textarea-container">
            ${isGenerating &&
            html`
              <div class="modal-loader-container">
                <div class="loader"></div>
                <p>Gemini está redactando el mensaje...</p>
              </div>
            `}
            <textarea
              value=${editedContent}
              onInput=${(e) => setEditedContent(e.target.value)}
              readonly=${isGenerating}
              placeholder="El mensaje generado por la IA aparecerá aquí..."
            ></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="button-secondary" onClick=${onClose}>Cerrar</button>
          <button
            class="button-primary"
            onClick=${() => onCopy(editedContent)}
            disabled=${!editedContent || isGenerating}
          >
            ${copySuccess ? "¡Copiado!" : "Copiar Texto"}
          </button>
        </div>
      </div>
    </div>
  `;
};

const Chatbot = ({ onClose, apiKey, processedData, companyName }) => {
  const [messages, setMessages] = useState([
    {
      role: "model",
      content: `¡Hola! Soy tu asistente de análisis. Pregúntame lo que quieras sobre los datos de la cartera de ${companyName}.`,
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const userMessage = inputValue.trim();
    if (!userMessage || isLoading) return;

    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInputValue("");
    setIsLoading(true);

    try {
      if (!chatRef.current) {
        const ai = new GoogleGenAI({ apiKey });
        const dataSummary = `
          Resumen de la Cartera de ${companyName}:
          - Saldo Total por Cobrar: $${processedData.totalReceivable.toLocaleString(
            "es-CO"
          )}
          - Número Total de Facturas Vencidas: ${processedData.totalInvoices}
          - Saldo Vencido a +90 Días: $${processedData.debtOver90Days.toLocaleString(
            "es-CO"
          )}
          - Riesgo de Concentración (Top 5 Clientes): ${processedData.concentrationRisk.toFixed(
            1
          )}%
          - Clientes con Mayor Deuda (Top 5): ${processedData.topDebtors
            .map(
              (d) =>
                `${d.nombre_cliente} ($${d.monto_factura.toLocaleString(
                  "es-CO"
                )})`
            )
            .join(", ")}
          - Desglose por Antigüedad: ${JSON.stringify(processedData.byAge)}
          - Desglose por Vendedor: ${JSON.stringify(
            processedData.bySalesperson
          )}
        `;

        chatRef.current = ai.chats.create({
          model: "gemini-2.5-flash",
          history: [
            {
              role: "user",
              parts: [
                {
                  text: `Eres un analista financiero experto. Tu única fuente de conocimiento es el siguiente resumen de datos de la cartera de una empresa. Responde a las preguntas del usuario de forma concisa y profesional, basándote exclusivamente en estos datos. Si no puedes responder, indícalo. No inventes información. Aquí están los datos:\n\n${dataSummary}`,
                },
              ],
            },
            {
              role: "model",
              parts: [
                {
                  text: "Entendido. Estoy listo para analizar estos datos y responder preguntas.",
                },
              ],
            },
          ],
        });
      }

      const response = await chatRef.current.sendMessage({
        message: userMessage,
      });

      setMessages((prev) => [
        ...prev,
        { role: "model", content: response.text },
      ]);
    } catch (err) {
      console.error("Chatbot error:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          content:
            "Lo siento, he encontrado un error al procesar tu pregunta. Por favor, inténtalo de nuevo.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return html`
    <div class="chatbot-window">
      <div class="chatbot-header">
        <h3>Chat de Análisis IA</h3>
        <button onClick=${onClose} class="chatbot-close-btn">&times;</button>
      </div>
      <div class="chatbot-messages">
        ${messages.map(
          (msg) => html`
            <div class="chat-message ${msg.role}">
              <p>${msg.content}</p>
            </div>
          `
        )}
        ${isLoading &&
        html`
          <div class="chat-message model">
            <div class="typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        `}
        <div ref=${messagesEndRef} />
      </div>
      <form class="chatbot-input-form" onSubmit=${handleSendMessage}>
        <input
          type="text"
          placeholder="Ej: ¿Quién es el mayor deudor?"
          value=${inputValue}
          onInput=${(e) => setInputValue(e.target.value)}
          disabled=${isLoading}
        />
        <button type="submit" disabled=${isLoading || !inputValue.trim()}>
          Enviar
        </button>
      </form>
    </div>
  `;
};

const sampleInvoices: Invoice[] = [
  {
    nombre_cliente: "Innovatec Corp",
    monto_factura: 750000,
    dias_vencida: 15,
    vendedor: "Ana Gómez",
  },
  {
    nombre_cliente: "Soluciones Digitales",
    monto_factura: 1200000,
    dias_vencida: 45,
    vendedor: "Carlos Rivas",
  },
  {
    nombre_cliente: "ConstruRed",
    monto_factura: 450000,
    dias_vencida: 95,
    vendedor: "Sofía Castro",
  },
  {
    nombre_cliente: "Logística Global",
    monto_factura: 890000,
    dias_vencida: 32,
    vendedor: "Ana Gómez",
  },
  {
    nombre_cliente: "Innovatec Corp",
    monto_factura: 300000,
    dias_vencida: 55,
    vendedor: "Ana Gómez",
  },
  {
    nombre_cliente: "Mercadeo Visual",
    monto_factura: 2500000,
    dias_vencida: 110,
    vendedor: "Luis Peña",
  },
  {
    nombre_cliente: "Soluciones Digitales",
    monto_factura: 650000,
    dias_vencida: 8,
    vendedor: "Carlos Rivas",
  },
  {
    nombre_cliente: "ConstruRed",
    monto_factura: 180000,
    dias_vencida: 25,
    vendedor: "Sofía Castro",
  },
  {
    nombre_cliente: "TecnoAvanzada",
    monto_factura: 3200000,
    dias_vencida: 65,
    vendedor: "Luis Peña",
  },
  {
    nombre_cliente: "Logística Global",
    monto_factura: 500000,
    dias_vencida: 72,
    vendedor: "Ana Gómez",
  },
  {
    nombre_cliente: "Innovatec Corp",
    monto_factura: 950000,
    dias_vencida: 120,
    vendedor: "Carlos Rivas",
  },
  {
    nombre_cliente: "Mercadeo Visual",
    monto_factura: 150000,
    dias_vencida: 5,
    vendedor: "Luis Peña",
  },
];

const sampleAnalysis = {
  portfolioHealth: {
    status: "Preocupante",
    reason:
      "Una porción significativa de la deuda (más del 40%) supera los 90 días, y existe una alta concentración de riesgo en unos pocos clientes clave.",
  },
  priorityAccounts: [
    {
      clientName: "Mercadeo Visual",
      totalDebt: 2650000,
      reason: "Mayor deudor con una factura crítica de más de 110 días.",
    },
    {
      clientName: "TecnoAvanzada",
      totalDebt: 3200000,
      reason:
        "Segundo mayor deudor con una deuda considerable en el rango de 61-90 días.",
    },
    {
      clientName: "Innovatec Corp",
      totalDebt: 2000000,
      reason:
        "Deuda distribuida en múltiples facturas, una de ellas con 120 días de vencimiento.",
    },
  ],
  insights: [
    "El vendedor Luis Peña gestiona las dos cuentas de mayor riesgo (Mercadeo Visual y TecnoAvanzada), que representan casi el 50% del saldo total.",
    "Más del 25% de la deuda total de la cartera tiene una antigüedad superior a 90 días, lo que indica un riesgo de incobrabilidad.",
    "El cliente 'Innovatec Corp' muestra un patrón de pago inconsistente, con facturas tanto recientes como muy antiguas.",
  ],
  recommendations: [
    "Implementar un plan de acción de cobro inmediato para 'Mercadeo Visual' y 'TecnoAvanzada', incluyendo la posibilidad de negociar un plan de pagos.",
    "Revisar las políticas de crédito y los límites asignados a los clientes con deudas recurrentes de más de 60 días.",
    "Establecer un sistema de comisiones para los vendedores que incentive no solo la venta, sino también la recuperación de cartera a tiempo.",
    "Utilizar el asistente de comunicación para enviar recordatorios periódicos y profesionales, comenzando con un tono amistoso.",
  ],
};

// --- Main App Component ---
const App = () => {
  const [apiKey, setApiKey] = useState("");
  const [apiKeyChecked, setApiKeyChecked] = useState(false);
  const [data, setData] = useState(null);
  const [fullData, setFullData] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [modalClient, setModalClient] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [reminderContent, setReminderContent] = useState("");
  const [isGeneratingReminder, setIsGeneratingReminder] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem("gemini_api_key");
    if (savedKey) {
      setApiKey(savedKey);
    }
    setApiKeyChecked(true);
  }, []);

  useEffect(() => {
    if (companyName) {
      document.title = `Análisis de Cuentas por Cobrar - ${companyName}`;
    }
  }, [companyName]);

  const handleKeySubmit = (key) => {
    localStorage.setItem("gemini_api_key", key);
    setApiKey(key);
  };

  const handleGenerateReminder = (client) => {
    setModalClient(client);
    setReminderContent(""); // Reset content when opening
  };

  const handleCloseModal = () => {
    setModalClient(null);
    setCopySuccess(false);
    setReminderContent("");
  };

  const handleCopyText = (text) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      },
      (err) => {
        console.error("Error al copiar texto: ", err);
      }
    );
  };

  const generateContentWithRetry = async (
    aiInstance,
    params,
    maxRetries = 3,
    initialDelay = 1000
  ) => {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        const response = await aiInstance.models.generateContent(params);
        return response;
      } catch (err) {
        const isRetryable =
          err.message.includes("503") ||
          err.message.toLowerCase().includes("overloaded") ||
          err.message.toLowerCase().includes("unavailable");
        if (isRetryable && attempt < maxRetries - 1) {
          attempt++;
          const delay = initialDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.warn(
            `API call failed (attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`,
            err
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          throw err; // Non-retryable error or max retries reached
        }
      }
    }
    throw new Error("Max retries reached");
  };

  const generateReminder = async (type) => {
    if (!modalClient || !apiKey) return;
    setIsGeneratingReminder(true);
    setReminderContent("");

    try {
      const ai = new GoogleGenAI({ apiKey });
      let prompt = "";
      const client = modalClient;
      const totalDebtFormatted = client.totalDebt.toLocaleString("es-CO", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      switch (type) {
        case "friendly":
          prompt = `Eres un asistente de cobranzas para la empresa "${companyName}". Redacta un correo electrónico de recordatorio corto, amistoso y profesional para el cliente "${client.nombre_cliente}". El cliente tiene una deuda total de $${totalDebtFormatted} correspondiente a ${client.invoiceCount} facturas. El tono debe ser muy cordial. Inicia con un asunto claro.`;
          break;
        case "persuasive":
          prompt = `Eres un especialista en cobranzas para la empresa "${companyName}". Redacta un correo electrónico de cobro persuasivo pero profesional para el cliente "${client.nombre_cliente}". El cliente tiene una deuda vencida de $${totalDebtFormatted} correspondiente a ${client.invoiceCount} facturas. Menciona la importancia de mantener un buen historial de crédito y la buena relación comercial. Pide una acción de pago inmediata. Inicia con un asunto claro.`;
          break;
        case "payment_plan":
          prompt = `Eres un gerente de relaciones con clientes para la empresa "${companyName}". Redacta un correo electrónico empático y proactivo para el cliente "${client.nombre_cliente}". El cliente tiene una deuda significativa de $${totalDebtFormatted} correspondiente a ${client.invoiceCount} facturas. En el texto, expresa que entiendes que pueden surgir dificultades y propón abrir un diálogo para establecer un plan de pagos flexible que se ajuste a sus posibilidades. El objetivo es encontrar una solución juntos y mantener la relación comercial. Inicia con un asunto claro.`;
          break;
      }

      const response = await generateContentWithRetry(ai, {
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      setReminderContent(response.text.trim());
    } catch (err) {
      console.error("Error generating reminder:", err);
      setReminderContent(`Error al generar el mensaje: ${err.message}`);
    } finally {
      setIsGeneratingReminder(false);
    }
  };

  const normalizeKey = (key) => {
    if (!key) return "";
    const str = String(key).toLowerCase().trim().replace(/\s+/g, "_");
    const normalizedStr = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    if (["nombre_cliente", "cliente"].includes(normalizedStr))
      return "nombre_cliente";
    if (
      ["monto_factura", "monto", "valor_factura", "valor"].includes(
        normalizedStr
      )
    )
      return "monto_factura";
    if (["dias_vencida", "dias_vencidos"].includes(normalizedStr))
      return "dias_vencida";
    if (["vendedor", "vendedora"].includes(normalizedStr)) return "vendedor";
    return normalizedStr;
  };

  const parseMonto = (value) => {
    if (typeof value === "number") return value;
    if (typeof value !== "string") return NaN;
    // Remove thousand separators (.) and then replace decimal comma (,) with a dot (.)
    return parseFloat(value.replace(/\./g, "").replace(",", "."));
  };

  const processInvoices = (invoices) => {
    let totalReceivable = 0;
    let weightedTotalDays = 0;
    const byAge = {
      "0-30 días": 0,
      "31-60 días": 0,
      "61-90 días": 0,
      "91+ días": 0,
    };
    const bySalesperson = {};
    const clientData = {};

    invoices.forEach((row) => {
      const amount = row.monto_factura;
      const days = row.dias_vencida;
      const salesperson = row.vendedor || "No asignado";
      const clientName = row.nombre_cliente;

      if (!isNaN(amount) && !isNaN(days) && clientName) {
        totalReceivable += amount;
        weightedTotalDays += days * amount;
        if (days <= 30) byAge["0-30 días"] += amount;
        else if (days <= 60) byAge["31-60 días"] += amount;
        else if (days <= 90) byAge["61-90 días"] += amount;
        else byAge["91+ días"] += amount;
        bySalesperson[salesperson] = (bySalesperson[salesperson] || 0) + amount;

        if (!clientData[clientName]) {
          clientData[clientName] = {
            totalDebt: 0,
            invoiceCount: 0,
            weightedDaysSum: 0,
          };
        }
        clientData[clientName].totalDebt += amount;
        clientData[clientName].invoiceCount += 1;
        clientData[clientName].weightedDaysSum += days * amount;
      }
    });

    const clientSummary = Object.keys(clientData).map((name) => ({
      nombre_cliente: name,
      totalDebt: clientData[name].totalDebt,
      invoiceCount: clientData[name].invoiceCount,
      weightedAvgDays:
        clientData[name].totalDebt > 0
          ? clientData[name].weightedDaysSum / clientData[name].totalDebt
          : 0,
    }));

    const sortedByDebt = [...clientSummary].sort(
      (a, b) => b.totalDebt - a.totalDebt
    );
    const topDebtors = sortedByDebt
      .slice(0, 5)
      .map((c) => ({
        nombre_cliente: c.nombre_cliente,
        monto_factura: c.totalDebt,
      }));
    const top5Debt = topDebtors.reduce(
      (acc, curr) => acc + curr.monto_factura,
      0
    );
    const concentrationRisk =
      totalReceivable > 0 ? (top5Debt / totalReceivable) * 100 : 0;

    const totalInvoices = invoices.length;
    const weightedAvgDays =
      totalReceivable > 0 ? weightedTotalDays / totalReceivable : 0;
    const debtOver90Days = byAge["91+ días"];

    return {
      totalReceivable,
      totalInvoices,
      weightedAvgDays,
      byAge,
      bySalesperson,
      topDebtors,
      concentrationRisk,
      clientSummary,
      debtOver90Days,
    };
  };

  const analyzeDataFromGrid = (grid, currentCompanyName) => {
    try {
      let headerRowIndex = -1;
      const requiredHeadersForDetection = ["nombre_cliente", "monto_factura"];

      for (let i = 0; i < grid.length; i++) {
        const row = grid[i].map((cell) => normalizeKey(cell));
        const foundHeaders = requiredHeadersForDetection.filter((h) =>
          row.includes(h)
        );
        if (foundHeaders.length === requiredHeadersForDetection.length) {
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex === -1) {
        throw new Error(
          "No se encontró la fila de encabezado. Asegúrate de que las columnas 'nombre_cliente' y 'monto_factura' existan."
        );
      }

      const headers = grid[headerRowIndex].map((h) => normalizeKey(h));
      const jsonData = grid
        .slice(headerRowIndex + 1)
        .map((row) => {
          const obj = {};
          headers.forEach((key, index) => {
            if (key) {
              const value = row[index] !== undefined ? row[index] : "";
              obj[key] =
                key === "monto_factura"
                  ? parseMonto(String(value))
                  : key === "dias_vencida"
                  ? parseInt(value, 10)
                  : value;
            }
          });
          return obj;
        })
        .filter(
          (obj) =>
            obj.monto_factura &&
            !isNaN(obj.monto_factura) &&
            String(obj.monto_factura).trim() !== ""
        );

      const cleanedJsonData = jsonData.filter(
        (row) =>
          row.nombre_cliente &&
          String(row.nombre_cliente).toLowerCase().trim() !== "total general"
      );

      if (cleanedJsonData.length === 0) {
        throw new Error(
          "No se encontraron datos de clientes válidos. Se excluyeron las filas de totales."
        );
      }

      const firstRowKeys = Object.keys(cleanedJsonData[0] || {});
      const requiredCols = [
        "monto_factura",
        "dias_vencida",
        "vendedor",
        "nombre_cliente",
      ];
      for (const col of requiredCols) {
        if (!firstRowKeys.includes(col)) {
          throw new Error(
            `Falta la columna requerida '${col}' o no se pudo reconocer. Revisa los encabezados del archivo.`
          );
        }
      }

      setCompanyName(currentCompanyName);
      const processedData = processInvoices(cleanedJsonData);
      setData(processedData);
      setFullData(cleanedJsonData);
      setFeedback(null);
      getAnalysis(processedData, currentCompanyName);
    } catch (err) {
      setFeedback({
        msg: `Error al procesar los datos: ${err.message}`,
        isError: true,
      });
      setData(null);
      console.error("Processing error:", err);
    }
  };

  const handleUseSampleData = () => {
    const company = "Empresa de Ejemplo S.A.S.";
    setCompanyName(company);
    const processedData = processInvoices(sampleInvoices);
    setData(processedData);
    setFullData(sampleInvoices);
    setAnalysis(sampleAnalysis); // Use pre-canned analysis
    setFeedback(null);
  };

  const getAnalysis = async (processedData, currentCompanyName) => {
    if (!apiKey) {
      setError("La clave de la API de Gemini no está configurada.");
      return;
    }
    setIsLoading(true);
    setAnalysis(null);
    setError("");

    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `
        Eres un estratega senior de cobranzas para la empresa llamada ${currentCompanyName}.
        Analiza el siguiente resumen de la cartera de cuentas por cobrar y proporciona un diagnóstico claro, identificando cuentas prioritarias, insights y recomendaciones accionables.

        Datos de la Cartera:
        - Saldo Total por Cobrar: $${processedData.totalReceivable.toLocaleString(
          "es-CO"
        )}
        - Número Total de Facturas Vencidas: ${processedData.totalInvoices}
        - Saldo Vencido a +90 Días: $${processedData.debtOver90Days.toLocaleString(
          "es-CO"
        )} (Considerado de alto riesgo)
        - Riesgo de Concentración (Top 5 Clientes): ${processedData.concentrationRisk.toFixed(
          1
        )}%
        - Clientes con Mayor Deuda (Top 5): ${processedData.topDebtors
          .map(
            (d) =>
              `${d.nombre_cliente} ($${d.monto_factura.toLocaleString(
                "es-CO"
              )})`
          )
          .join(", ")}
        - Desglose por Antigüedad: ${JSON.stringify(processedData.byAge)}
        - Desglose por Vendedor: ${JSON.stringify(processedData.bySalesperson)}

        Genera una respuesta en formato JSON con la siguiente estructura:
        1.  **portfolioHealth**: Una evaluación general del estado de la cartera.
            -   **status**: Una sola palabra: "Saludable", "Preocupante" o "Crítica".
            -   **reason**: Una explicación concisa (1-2 frases) del porqué de ese estado.
        2.  **priorityAccounts**: Un array con las 3 cuentas de cliente más críticas que requieren acción inmediata. Para cada una:
            -   **clientName**: Nombre del cliente.
            -   **totalDebt**: Monto total de su deuda.
            -   **reason**: Por qué es una prioridad (ej. "Monto elevado y antigüedad crítica de más de 90 días").
        3.  **insights**: Un array de 3-4 observaciones clave sobre patrones, riesgos u oportunidades no evidentes en los datos brutos.
        4.  **recommendations**: Un array de 3-4 acciones estratégicas y concretas para mejorar la cobranza, basadas en los insights anteriores.
      `;
      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          portfolioHealth: {
            type: Type.OBJECT,
            properties: {
              status: {
                type: Type.STRING,
                description:
                  'La evaluación general de la cartera (Ej: "Saludable", "Preocupante", "Crítica").',
              },
              reason: {
                type: Type.STRING,
                description: "Una breve justificación para el estado.",
              },
            },
            required: ["status", "reason"],
          },
          priorityAccounts: {
            type: Type.ARRAY,
            description:
              "Las 3 principales cuentas de cliente que requieren acción inmediata.",
            items: {
              type: Type.OBJECT,
              properties: {
                clientName: {
                  type: Type.STRING,
                  description: "Nombre del cliente.",
                },
                totalDebt: {
                  type: Type.NUMBER,
                  description: "Monto total de la deuda del cliente.",
                },
                reason: {
                  type: Type.STRING,
                  description: "Por qué este cliente es una prioridad.",
                },
              },
              required: ["clientName", "totalDebt", "reason"],
            },
          },
          insights: {
            type: Type.ARRAY,
            description:
              "Observaciones clave y puntos críticos sobre los datos de la cartera de la empresa.",
            items: { type: Type.STRING },
          },
          recommendations: {
            type: Type.ARRAY,
            description:
              "Acciones concretas y estratégicas para optimizar la cobranza y la gestión de la cartera.",
            items: { type: Type.STRING },
          },
        },
      };

      const response = await generateContentWithRetry(ai, {
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema,
        },
      });

      const jsonResponse = JSON.parse(response.text.trim());
      setAnalysis(jsonResponse);
    } catch (err) {
      console.error("Error al generar análisis:", err);
      setError(
        "Hubo un problema al contactar a la IA. Revisa tu clave de API e inténtalo de nuevo."
      );
      setFeedback({
        msg: `Error de la API: ${err.message}. Asegúrate de que tu clave de API sea correcta y tenga los permisos necesarios.`,
        isError: true,
      });
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFile = (file, name) => {
    const reader = new FileReader();
    const fileExtension = file.name.split(".").pop().toLowerCase();

    reader.onerror = () => {
      setFeedback({ msg: "Error al leer el archivo.", isError: true });
    };

    if (fileExtension === "csv") {
      reader.onload = (e) => {
        try {
          const text = e.target.result as string;
          if (!text || text.trim().length === 0) {
            throw new Error("El archivo CSV está vacío o no tiene contenido.");
          }
          const grid = text
            .trim()
            .split("\n")
            .map((row) => row.split(",").map((cell) => cell.trim()));
          analyzeDataFromGrid(grid, name);
        } catch (err) {
          console.error("Error procesando CSV:", err);
          setFeedback({
            msg: `Error al procesar el archivo CSV: ${err.message}`,
            isError: true,
          });
        }
      };
      reader.readAsText(file);
    } else if (fileExtension === "xlsx" || fileExtension === "xls") {
      reader.onload = (e) => {
        try {
          if (!e.target.result) {
            throw new Error("No se pudo leer el contenido del archivo Excel.");
          }
          const data = new Uint8Array(e.target.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          if (!sheetName) {
            throw new Error("El archivo Excel no contiene hojas.");
          }
          const worksheet = workbook.Sheets[sheetName];
          const grid = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: "",
          });
          analyzeDataFromGrid(grid, name);
        } catch (err) {
          console.error("Error procesando Excel:", err);
          setFeedback({
            msg: `Error al procesar el archivo Excel: ${err.message}`,
            isError: true,
          });
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setFeedback({
        msg: "Formato de archivo no soportado. Por favor, usa CSV o Excel.",
        isError: true,
      });
    }
  };

  if (!apiKeyChecked) {
    return null; // or a loading spinner
  }

  return html`
    <div class="container">
      ${!apiKey
        ? html`<${ApiKeyScreen} onKeySubmit=${handleKeySubmit} />`
        : !data
        ? html`<${FileUploadScreen}
            onFile=${handleFile}
            feedback=${feedback}
            onUseSampleData=${handleUseSampleData}
          />`
        : html`
            <${Dashboard}
              data=${data}
              fullData=${fullData}
              analysis=${analysis}
              isLoading=${isLoading}
              error=${error}
              onGenerateReminder=${handleGenerateReminder}
              companyName=${companyName}
            />
            <button
              class="chatbot-fab"
              onClick=${() => setIsChatOpen(true)}
              title="Abrir Chat de Análisis"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"
                ></path>
              </svg>
            </button>
          `}
      ${modalClient &&
      html`<${ReminderModal}
        client=${modalClient}
        onClose=${handleCloseModal}
        onCopy=${handleCopyText}
        copySuccess=${copySuccess}
        companyName=${companyName}
        generateReminder=${generateReminder}
        reminderContent=${reminderContent}
        isGenerating=${isGeneratingReminder}
      />`}
      ${isChatOpen &&
      data &&
      html`<div
          class="chatbot-backdrop"
          onClick=${() => setIsChatOpen(false)}
        ></div>
        <${Chatbot}
          onClose=${() => setIsChatOpen(false)}
          apiKey=${apiKey}
          processedData=${data}
          companyName=${companyName}
        />`}
    </div>
  `;
};

render(html`<${App} />`, document.getElementById("root"));

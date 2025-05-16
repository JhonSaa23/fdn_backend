import os
import pyodbc
import dbfpy3.dbf

# Configuración de la conexión a la base de datos
server = 'Server'
database = 'SIFANO'
username = 'Farmacos6'
password = '2011'

# Crear la conexión a SQL Server
connection = pyodbc.connect(
    f'DRIVER={{SQL Server}};SERVER={server};DATABASE={database};UID={username};PWD={password}'
)

# Ruta para el archivo DBF de salida
output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'uploads', 'CD000225.dbf')

try:
    # Ejecutar consulta para obtener los datos
    cursor = connection.cursor()
    cursor.execute("SELECT * FROM CD000225")
    rows = cursor.fetchall()
    
    # Obtener información de las columnas
    columns = [column[0] for column in cursor.description]
    
    # Crear archivo DBF
    db = dbfpy3.dbf.Dbf(output_path, new=True)
    
    # Definir campos
    for i, column in enumerate(cursor.description):
        # Determinar el tipo de campo y tamaño
        name = column[0]
        type_code = column[1]
        field_size = column[3] or 10
        
        # Mapear tipos de SQL Server a tipos DBF
        if type_code in (pyodbc.SQL_NUMERIC, pyodbc.SQL_DECIMAL, pyodbc.SQL_FLOAT, pyodbc.SQL_REAL):
            db.addField((name, 'N', field_size, 2))
        elif type_code in (pyodbc.SQL_INTEGER, pyodbc.SQL_SMALLINT, pyodbc.SQL_TINYINT):
            db.addField((name, 'N', field_size, 0))
        elif type_code in (pyodbc.SQL_TYPE_DATE, pyodbc.SQL_TYPE_TIMESTAMP):
            db.addField((name, 'D', 8))
        else:
            db.addField((name, 'C', min(field_size, 254)))
    
    # Agregar registros
    for row in rows:
        rec = db.newRecord()
        for i, value in enumerate(row):
            if value is not None:
                rec[columns[i]] = value
        rec.store()
    
    db.close()
    print(f"Archivo DBF generado en {output_path}")
    
except Exception as e:
    print(f"Error: {str(e)}")
    
finally:
    connection.close() 